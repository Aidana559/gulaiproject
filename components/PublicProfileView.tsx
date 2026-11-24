"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiMessageCircle } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import BookCover from "@/components/BookCover";
import { Button, LinkButton } from "@/components/Button";
import { Stars } from "@/components/Stars";
import { categoryLabels, type Book } from "@/data/books";
import { LIVE_HINTS, LIVE_LABELS, LIVE_STYLES } from "@/lib/book-live";
import { subscribeBookingsChanged } from "@/lib/bookings-sync";
import { useChatSession } from "@/lib/chatStore";
import { localAvatarOf } from "@/lib/localAvatar";
import { canViewPublicProfiles } from "@/lib/profile-access";
import type { PublicProfile } from "@/lib/public-profile";
import { useTaxonomy } from "@/components/TaxonomyProvider";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: PublicProfile }
  | { kind: "missing" }
  | { kind: "denied" }
  | { kind: "anon" }
  | { kind: "error"; message: string };

/** Как часто перечитывать статусы, пока вкладка открыта (кроме мгновенных сигналов и возврата на вкладку). */
const REFRESH_MS = 20_000;

function Notice({ title, text, children }: { title?: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
      {title && <p className="font-semibold text-stone-800">{title}</p>}
      <p className={title ? "mt-1 text-stone-600" : "text-stone-700"}>{text}</p>
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export default function PublicProfileView({ userId }: { userId: string }) {
  useTaxonomy(); // подписка: подписи категорий обновляются, когда администратор их меняет
  const { user, loading } = useAuth();
  const chat = useChatSession();
  const [state, setState] = useState<Load>({ kind: "loading" });

  // Роль берётся из серверной сессии; сервер проверяет её ещё раз в каждом запросе
  const allowed = !!user && canViewPublicProfiles(user.role);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
      if (res.status === 401) return setState({ kind: "anon" });
      if (res.status === 403) return setState({ kind: "denied" });
      if (res.status === 404) return setState({ kind: "missing" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? "Не удалось загрузить профиль");
      setState({ kind: "ok", data: json as PublicProfile });
    } catch (e) {
      // при сбое фонового обновления остаётся последняя удачная версия
      setState((prev) =>
        prev.kind === "ok" ? prev : { kind: "error", message: e instanceof Error ? e.message : "Нет связи с сервером" },
      );
    }
  }, [userId]);

  // Первая загрузка и автообновление статусов: по таймеру, при возврате на вкладку
  // и мгновенно, когда в другой вкладке кто-то забронировал / выдал / вернул / отменил книгу.
  useEffect(() => {
    if (!allowed) return;
    // загрузка профиля при открытии страницы
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const off = subscribeBookingsChanged(() => void load());
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      off();
    };
  }, [allowed, load]);

  if (loading) return <p className="text-stone-500">Загрузка…</p>;
  if (!user || state.kind === "anon") {
    return (
      <Notice text="Войдите, чтобы смотреть профили пользователей.">
        <LinkButton href="/login">Войти</LinkButton>
      </Notice>
    );
  }
  if (!allowed || state.kind === "denied") {
    return (
      <Notice title="Раздел недоступен" text="Профили пользователей доступны только обычным пользователям.">
        <LinkButton href="/" variant="outline">На главную</LinkButton>
      </Notice>
    );
  }
  if (state.kind === "loading") return <p className="text-stone-500">Загрузка профиля…</p>;
  if (state.kind === "missing") {
    return (
      <Notice title="Пользователь не найден" text="Такого профиля нет или он недоступен.">
        <LinkButton href="/catalog" variant="outline">В каталог</LinkButton>
      </Notice>
    );
  }
  if (state.kind === "error") {
    return (
      <Notice text={state.message}>
        <Button variant="outline" onClick={() => void load()}>Повторить</Button>
      </Notice>
    );
  }

  const { user: p, rating, books } = state.data;
  const isMe = String(user.id) === p.id;
  // «Написать»: только другому пользователю с ролью user из серверного справочника чатов
  const canWrite = !isMe && chat.status === "ok" && !!chat.peers?.has(p.id);

  return (
    <>
      <nav className="text-sm text-stone-500">
        <Link href="/catalog" className="hover:text-indigo-600">Каталог</Link> / Профиль
      </nav>

      <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:p-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <Avatar
            name={p.name}
            src={isMe ? user.avatar : localAvatarOf(p.id)}
            className="size-24 shrink-0 text-4xl font-semibold"
          />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-3xl text-stone-900 sm:text-4xl">{p.name}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-stone-600 sm:justify-start">
              <Stars value={rating.average} className="text-lg" />
              <span>{rating.count ? `${rating.average.toFixed(1)} (${rating.count})` : "Нет оценок"}</span>
            </div>
            <p className="mt-1 text-sm text-stone-500">Опубликовано книг: {books.length}</p>
            {isMe && <p className="mt-1 text-sm text-stone-500">Так вас видят другие пользователи.</p>}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            {canWrite && (
              <LinkButton href={`/messages?with=${encodeURIComponent(p.id)}`} size="lg">
                <FiMessageCircle /> Написать
              </LinkButton>
            )}
            {isMe && (
              <LinkButton href="/profile" variant="outline">Редактировать профиль</LinkButton>
            )}
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-2xl text-stone-900">Книги пользователя</h2>
        <p className="text-xs text-stone-400">Статусы обновляются автоматически</p>
      </div>

      {books.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
          У пользователя пока нет опубликованных книг.
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <li key={b.id} className="min-w-0">
              <article className="group flex h-full flex-col rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg sm:p-4">
                <Link href={`/book/${b.id}`} aria-label={b.title}>
                  <BookCover book={b as unknown as Book} />
                </Link>
                <div className="mt-3 flex flex-1 flex-col sm:mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                      {categoryLabels[b.category] ?? b.category}
                    </span>
                    <span
                      title={LIVE_HINTS[b.status]}
                      className={`inline-flex h-fit w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${LIVE_STYLES[b.status]}`}
                    >
                      {LIVE_LABELS[b.status]}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 break-words font-semibold text-stone-900">
                    <Link href={`/book/${b.id}`} className="hover:text-indigo-600">{b.title}</Link>
                  </h3>
                  <p className="mt-1 truncate text-sm text-stone-500">{b.author}</p>
                  {b.genres.length > 0 && (
                    <p className="mt-1 line-clamp-1 text-xs text-stone-400">{b.genres.join(", ")}</p>
                  )}
                  <div className="mt-4 flex-1" />
                  <LinkButton href={`/book/${b.id}`} variant="outline" size="sm" full>
                    Подробнее
                  </LinkButton>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
