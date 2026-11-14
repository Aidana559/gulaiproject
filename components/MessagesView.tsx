"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiMessageCircle, FiSearch, FiSend } from "react-icons/fi";
import Avatar from "@/components/Avatar";
import { Button, LinkButton } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";
import {
  MESSAGE_MAX,
  conversationId,
  markSeen,
  newConversation,
  roleIn,
  sendMessage,
  unreadIn,
  useMyChats,
  type ChatRole,
  type Conversation,
  type Me,
} from "@/lib/chatStore";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

/** Аватар собеседника из его профиля в этом браузере (если задан), иначе заглушка. */
function avatarOf(id?: string): string | null {
  if (!id) return null;
  try {
    return JSON.parse(localStorage.getItem(`profile-extra:${id}`) ?? "{}").avatar ?? null;
  } catch {
    return null;
  }
}

const dayKey = (iso: string) => new Date(iso).toDateString();

export default function MessagesView() {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-stone-500">Загрузка…</p>;
  if (!user) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
        <p className="text-stone-700">Войдите, чтобы переписываться с владельцами книг.</p>
        <div className="mt-4 flex justify-center">
          <LinkButton href="/login">Войти</LinkButton>
        </div>
      </div>
    );
  }
  // key: при смене аккаунта состояние сбрасывается
  const me: Me = { id: String(user.id), name: user.name };
  return <Inner key={me.id} me={me} />;
}

function Inner({ me }: { me: Me }) {
  const bookParam = useSearchParams().get("book");
  const mine = useMyChats(me);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Conversation | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "own" | "error">(
    bookParam ? "loading" : "idle",
  );
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // Владелец определяется по книге: сервер отдаёт ownerId / owner
  useEffect(() => {
    if (!bookParam) return;
    let off = false;
    fetch(`/api/books/${encodeURIComponent(bookParam)}?view=0`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error ?? "Книга не найдена");
        return b as { id: string | number; title: string; author: string; owner?: string; ownerId?: string };
      })
      .then((b) => {
        if (off) return;
        if (b.ownerId == null) throw new Error("У этой книги нет владельца-пользователя, писать некому.");
        const isOwn =
          (b.ownerId != null && String(b.ownerId) === me.id) || (!!b.owner && b.owner === me.name);
        if (isOwn) return setStatus("own");
        const owner = { id: b.ownerId != null ? String(b.ownerId) : undefined, name: b.owner || "Владелец" };
        const book = { id: String(b.id), title: b.title, author: b.author };
        setDraft(newConversation(book, me, owner));
        setSelected(conversationId(book.id, me.id, owner)); // уже есть — откроется существующий
        setStatus("idle");
      })
      .catch((e: Error) => {
        if (off) return;
        setError(e.message);
        setStatus("error");
      });
    return () => {
      off = true;
    };
  }, [bookParam, me]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      q
        ? mine.filter((c) => {
            const other = roleIn(c, me) === "buyer" ? c.owner.name : c.buyer.name;
            return other.toLowerCase().includes(q) || c.bookTitle.toLowerCase().includes(q);
          })
        : mine,
    [mine, q, me],
  );

  const conv = mine.find((c) => c.id === selected) ?? (draft?.id === selected ? draft : null);

  if (status === "loading") return <p className="text-stone-500">Открываем чат…</p>;
  if (status === "own") {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
        <p className="text-stone-700">Это ваша книга — писать самому себе не нужно.</p>
        <div className="mt-4 flex justify-center">
          <LinkButton href="/messages" variant="outline">Все сообщения</LinkButton>
        </div>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
        <p className="text-stone-700">{error}</p>
        <div className="mt-4 flex justify-center">
          <LinkButton href="/catalog" variant="outline">В каталог</LinkButton>
        </div>
      </div>
    );
  }

  // Переписок нет совсем — одно аккуратное пустое состояние вместо двух панелей
  if (mine.length === 0 && !conv) {
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-16 text-center text-stone-500 ring-1 ring-stone-200">
        <FiMessageCircle className="text-5xl text-stone-300" strokeWidth={1.5} />
        <p className="mt-3 font-semibold text-stone-800">Переписок пока нет</p>
        <p className="mt-1 max-w-sm text-sm">
          Чат можно начать со страницы книги — нажмите «Написать владельцу».
        </p>
        <div className="mt-4">
          <LinkButton href="/catalog" variant="secondary" size="sm">Открыть каталог</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-shell rounded-2xl bg-white ring-1 ring-stone-200" data-open={selected ? "1" : "0"}>
      <aside className="chat-list flex-col border-stone-200 md:border-r">
        <div className="border-b border-stone-200 p-3">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или книге"
              aria-label="Поиск по чатам"
              className="w-full rounded-full border border-stone-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {mine.length > 0 && shown.length === 0 && (
            <li className="p-4 text-center text-sm text-stone-500">Ничего не найдено</li>
          )}
          {shown.map((c) => {
            const role = roleIn(c, me)!;
            const otherP = role === "buyer" ? c.owner : c.buyer;
            const other = otherP.name;
            const last = c.messages[c.messages.length - 1];
            const unread = unreadIn(c, role);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 ${
                    c.id === selected ? "bg-indigo-50" : ""
                  }`}
                >
                  <Avatar name={other} src={avatarOf(otherP.id)} className="size-10 shrink-0 text-base" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-stone-900">{other}</span>
                      {last && <span className="shrink-0 text-xs text-stone-400">{time(last.at)}</span>}
                    </span>
                    <span className="block truncate text-xs text-indigo-700">«{c.bookTitle}»</span>
                    <span className="block truncate text-sm text-stone-500">{last?.text ?? "Нет сообщений"}</span>
                  </span>
                  {unread > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="chat-pane flex-col">
        {conv ? (
          <ChatPane key={conv.id} conv={conv} role={roleIn(conv, me) ?? "buyer"} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-stone-500">
            Выберите диалог слева
          </div>
        )}
      </section>
    </div>
  );
}

function ChatPane({ conv, role, onBack }: { conv: Conversation; role: ChatRole; onBack: () => void }) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const otherP = role === "buyer" ? conv.owner : conv.buyer;
  const other = otherP.name;
  const count = conv.messages.length;

  useEffect(() => {
    markSeen(conv.id, role);
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conv.id, role, count]);

  const items = useMemo(
    () =>
      conv.messages.map((m, i) => ({
        m,
        newDay: i === 0 || dayKey(conv.messages[i - 1].at) !== dayKey(m.at),
      })),
    [conv.messages],
  );

  function submit() {
    if (!text.trim()) return;
    sendMessage(conv, role, text);
    setText("");
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-stone-200 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="К списку диалогов"
          className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"
        >
          <FiArrowLeft className="size-5" />
        </button>
        <Avatar name={other} src={avatarOf(otherP.id)} className="size-10 shrink-0 text-base" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{other}</p>
          <Link
            href={`/book/${conv.bookId}`}
            className="block truncate text-xs text-indigo-700 hover:underline"
          >
            «{conv.bookTitle}» · {conv.bookAuthor}
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden bg-stone-50 px-3 py-4 sm:px-4">
        {count === 0 && (
          <p className="py-8 text-center text-sm text-stone-500">
            Сообщений пока нет. Напишите первое.
          </p>
        )}
        {items.map(({ m, newDay }) => {
          const mineMsg = m.from === role;
          return (
            <div key={m.id}>
              {newDay && (
                <p className="my-3 text-center text-xs text-stone-400">{dayLabel(m.at)}</p>
              )}
              <div className={`flex ${mineMsg ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] min-w-0 rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    mineMsg
                      ? "rounded-br-md bg-indigo-600 text-white"
                      : "rounded-bl-md bg-white text-stone-900 ring-1 ring-stone-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
                  <p className={`mt-1 text-right text-[11px] ${mineMsg ? "text-indigo-200" : "text-stone-400"}`}>
                    {time(m.at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-stone-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={MESSAGE_MAX}
            placeholder="Сообщение…"
            aria-label="Сообщение"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-stone-300 px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <Button onClick={submit} disabled={!text.trim()} aria-label="Отправить" className="size-10 shrink-0 !p-0">
            <FiSend />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">
          Сообщения хранятся только в этом браузере.
        </p>
      </div>
    </>
  );
}
