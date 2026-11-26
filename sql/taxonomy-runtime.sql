begin;
create or replace function public.kitapta_taxonomy_mutate(p_action text, p_id text, p_values jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  old_name text;
  new_name text := p_values->>'name';
  affected integer := 0;
  destination text := p_values->>'moveTo';
begin
  perform pg_advisory_xact_lock(719201);
  if p_action = 'add_category' then
    insert into categories(key,label,singular,icon,poster) values(p_id,p_values->>'label',p_values->>'singular',p_values->>'icon',p_values->>'poster');
  elsif p_action = 'update_category' then
    update categories set label=p_values->>'label',singular=p_values->>'singular',icon=p_values->>'icon',poster=p_values->>'poster' where key=p_id;
    if not found then raise exception 'Категория не найдена'; end if;
  elsif p_action = 'delete_category' then
    if (select count(*) from categories)<=1 then raise exception 'Нельзя удалить последнюю категорию'; end if;
    if exists(select 1 from books where category_key=p_id) then
      if destination is null or destination=p_id or not exists(select 1 from categories where key=destination) then raise exception 'Выберите другую категорию для связанных книг'; end if;
      update books set category_key=destination,updated_at=now() where category_key=p_id;
      get diagnostics affected = row_count;
    end if;
    delete from categories where key=p_id;
    if not found then raise exception 'Категория не найдена'; end if;
  elsif p_action = 'add_genre' then
    insert into genres(id,name) values(p_id,new_name);
  elsif p_action in ('update_genre','delete_genre') then
    select name into old_name from genres where id=p_id for update;
    if not found then raise exception 'Жанр не найден'; end if;
    select count(*) into affected from book_genres where genre_id=p_id;
    if p_action='update_genre' and old_name=new_name then return 0; end if;
    update books b set legacy_data=coalesce(b.legacy_data,'{}'::jsonb)||jsonb_build_object('runtime_genres',coalesce((select jsonb_agg(case when lower(x.name)=lower(old_name) then new_name else x.name end order by x.ord) from jsonb_array_elements_text(case when jsonb_typeof(b.legacy_data->'runtime_genres')='array' then b.legacy_data->'runtime_genres' when jsonb_typeof(coalesce(b.legacy_data->'user',b.legacy_data->'catalog')->'genres')='array' then coalesce(b.legacy_data->'user',b.legacy_data->'catalog')->'genres' else coalesce((select jsonb_agg(g.name order by g.id) from book_genres bg join genres g on g.id=bg.genre_id where bg.book_id=b.id),'[]'::jsonb) end) with ordinality x(name,ord) where p_action='update_genre' or lower(x.name)<>lower(old_name)),'[]'::jsonb)),updated_at=now() where exists(select 1 from book_genres bg where bg.book_id=b.id and bg.genre_id=p_id);
    if p_action='update_genre' then
      update genres set name=new_name where id=p_id;
    else
      delete from book_genres where genre_id=p_id;
      delete from genres where id=p_id;
    end if;
  else
    raise exception 'Unknown taxonomy action';
  end if;
  return affected;
end;
$$;
revoke all on function public.kitapta_taxonomy_mutate(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.kitapta_taxonomy_mutate(text,text,jsonb) to service_role;
commit;
