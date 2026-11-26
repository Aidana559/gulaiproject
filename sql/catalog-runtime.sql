begin;
create or replace function public.kitapta_save_book(p_id text, p_values jsonb, p_create boolean, p_genres text[])
returns text language plpgsql security invoker set search_path = public as $$
declare
  k text;
  cols text;
  vals text;
  assignments text;
  gid text;
  g text;
  aid text;
  aname text;
  allowed constant text[] := array['title','author','category_key','owner_id','owner_name','description','isbn','google_id','cover_url','gradient','city','campus','year','pages','condition','status','views','reviewed','hidden','deleted','owner_hidden','owner_hidden_at','hidden_until','hidden_reason','hidden_at','hidden_by','deleted_at','deleted_reason','deleted_by','moderation_note','created_at','updated_at'];
begin
  for k in select jsonb_object_keys(p_values) loop
    if not k = any(allowed) then raise exception 'Invalid field: %', k; end if;
  end loop;
  if p_create then
    perform pg_advisory_xact_lock(719201);
    select greatest(p_id::bigint, coalesce(max(n)+1,1001))::text into p_id from (
      select id::bigint n from books where id ~ '^[0-9]{1,15}$'
      union all select legacy_book_id::bigint from bookings where legacy_book_id ~ '^[0-9]{1,15}$'
      union all select book_id::bigint from moderation_logs where book_id ~ '^[0-9]{1,15}$'
      union all select legacy_book_id::bigint from reports where legacy_book_id ~ '^[0-9]{1,15}$'
      union all select target_id::bigint from reviews where target_type='book' and target_id ~ '^[0-9]{1,15}$'
    ) refs;
    p_values := p_values || jsonb_build_object('id',p_id);
    select string_agg(format('%I',x),','), string_agg(format('r.%I',x),',') into cols,vals from jsonb_object_keys(p_values) x;
    execute format('insert into public.books (%s) select %s from jsonb_populate_record(null::public.books,$1) r',cols,vals) using p_values;
  else
    perform 1 from books where id=p_id for update;
    if not found then raise exception 'Book not found'; end if;
    if p_values ? 'owner_id' then raise exception 'Owner changes not supported'; end if;
    select string_agg(format('%I = r.%I',x,x),',') into assignments from jsonb_object_keys(p_values) x;
    if assignments is not null then
      execute format('update public.books b set %s from jsonb_populate_record(null::public.books,$1) r where b.id=$2',assignments) using p_values,p_id;
    end if;
  end if;
  if p_genres is not null then
    delete from book_genres where book_id=p_id;
    foreach g in array p_genres loop
      select id into gid from genres where lower(name)=lower(g) limit 1;
      if gid is null then raise exception 'Unknown genre: %',g; end if;
      insert into book_genres(book_id,genre_id) values(p_id,gid) on conflict do nothing;
    end loop;
    update books set legacy_data=coalesce(legacy_data,'{}'::jsonb)||jsonb_build_object('runtime_genres',to_jsonb(p_genres)) where id=p_id;
  end if;
  if p_values ? 'author' then
    delete from book_authors where book_id=p_id;
    aname := trim(p_values->>'author');
    if aname <> '' then
      select id into aid from authors where lower(name)=lower(aname) order by id limit 1;
      if aid is null then
        aid := 'runtime-'||md5(lower(aname));
        insert into authors(id,name) values(aid,aname) on conflict(id) do nothing;
      end if;
      insert into book_authors(book_id,author_id) values(p_id,aid) on conflict do nothing;
    end if;
  end if;
  return p_id;
end;
$$;
create or replace function public.kitapta_increment_views(p_id text)
returns void language sql security invoker set search_path=public as $$
  update public.books set views=coalesce(views,0)+1 where id=p_id;
$$;
revoke all on function public.kitapta_save_book(text,jsonb,boolean,text[]) from public,anon,authenticated;
revoke all on function public.kitapta_increment_views(text) from public,anon,authenticated;
grant execute on function public.kitapta_save_book(text,jsonb,boolean,text[]) to service_role;
grant execute on function public.kitapta_increment_views(text) to service_role;
commit;
