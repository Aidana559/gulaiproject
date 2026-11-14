"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiBook, FiCheck, FiMessageCircle, FiMoreVertical, FiSearch, FiSend, FiTrash2, FiX } from "react-icons/fi";
import Avatar from "@/components/Avatar";
import { Button, LinkButton } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";
import {
  ChatAccessError,
  MESSAGE_MAX,
  deleteConversations,
  isBookRef,
  markSeen,
  openChatWithBook,
  otherOf,
  previewOf,
  sendMessage,
  unreadIn,
  useChatSession,
  useMyChats,
  type BookRefMessage,
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
  // Уровень 1: роль и id берём из серверной сессии (chatStore), а не из useAuth()
  // (там профиль смешан с данными из localStorage)
  return <Gate />;
}

function Gate() {
  const chat = useChatSession();
  if (chat.status === "loading") return <p className="text-stone-500">Загрузка…</p>;
  if (chat.status === "denied") {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
        <p className="font-semibold text-stone-800">Раздел недоступен</p>
        <p className="mt-1 text-stone-600">Сообщения доступны только обычным пользователям.</p>
        <div className="mt-4 flex justify-center">
          <LinkButton href="/" variant="outline">На главную</LinkButton>
        </div>
      </div>
    );
  }
  if (chat.status !== "ok" || !chat.me) return null;
  // key: при смене аккаунта состояние сбрасывается
  return <Inner key={chat.me.id} me={chat.me} />;
}

function Inner({ me }: { me: Me }) {
  const bookParam = useSearchParams().get("book");
  const mine = useMyChats();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "own" | "error">(
    bookParam ? "loading" : "idle",
  );
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  // режим выбора чатов (меню «⋮» → «Выбрать»)
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [listError, setListError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  // «Написать владельцу»: владелец определяется по книге; чат с ним один на пару пользователей —
  // существующий открывается, а карточка выбранной книги добавляется в конец переписки.
  const meId = me.id;
  const meName = me.name;
  useEffect(() => {
    if (!bookParam) return;
    let off = false;
    fetch(`/api/books/${encodeURIComponent(bookParam)}?view=0`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error ?? "Книга не найдена");
        return b as {
          id: string | number;
          title: string;
          author: string;
          coverUrl?: string | null;
          owner?: string;
          ownerId?: string;
        };
      })
      .then((b) => {
        if (off) return;
        if (b.ownerId == null) throw new Error("У этой книги нет владельца-пользователя, писать некому.");
        const isOwn = (b.ownerId != null && String(b.ownerId) === meId) || (!!b.owner && b.owner === meName);
        if (isOwn) return setStatus("own");
        const book = { id: String(b.id), title: b.title, author: b.author, coverUrl: b.coverUrl ?? null };
        // проверка прав внутри: оба участника должны быть user; повторный вызов карточку не дублирует
        const chatId = openChatWithBook(book, String(b.ownerId));
        setSelected(chatId);
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
  }, [bookParam, meId, meName]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      q
        ? mine.filter(
            (c) =>
              otherOf(c, me.id).name.toLowerCase().includes(q) ||
              c.messages.some((m) => isBookRef(m) && m.book.title.toLowerCase().includes(q)),
          )
        : mine,
    [mine, q, me],
  );

  const mineIds = useMemo(() => new Set(mine.map((c) => c.id)), [mine]);
  const pickedCount = [...picked].filter((id) => mineIds.has(id)).length;
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));

  const exitSelect = () => {
    setSelecting(false);
    setPicked(new Set());
    setConfirmDel(false);
    setListError("");
  };
  const toggle = (id: string) => {
    setConfirmDel(false);
    setPicked((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setConfirmDel(false);
    setPicked(allShownPicked ? new Set() : new Set(shown.map((c) => c.id)));
  };
  function removePicked() {
    const ids = [...picked].filter((id) => mineIds.has(id));
    try {
      deleteConversations(ids); // проверка прав внутри; при отказе ничего не удалено
    } catch (e) {
      if (!(e instanceof ChatAccessError)) throw e;
      setConfirmDel(false);
      setListError(e.message);
      return;
    }
    if (selected && ids.includes(selected)) setSelected(null);
    exitSelect();
  }

  const conv = mine.find((c) => c.id === selected) ?? null;

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
        <div className="flex items-center gap-2 border-b border-stone-200 p-3">
          <div className="relative min-w-0 flex-1">
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
          {selecting ? (
            <button
              type="button"
              onClick={exitSelect}
              aria-label="Отменить выбор"
              title="Отменить выбор"
              className="shrink-0 rounded-full p-2 text-stone-600 hover:bg-stone-100"
            >
              <FiX className="size-5" />
            </button>
          ) : (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Меню чатов"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="rounded-full p-2 text-stone-600 hover:bg-stone-100"
              >
                <FiMoreVertical className="size-5" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-stone-200"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setSelecting(true);
                    }}
                    disabled={mine.length === 0}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-stone-800 hover:bg-stone-50 disabled:text-stone-400"
                  >
                    <FiCheck className="size-4" /> Выбрать
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {mine.length > 0 && shown.length === 0 && (
            <li className="p-4 text-center text-sm text-stone-500">Ничего не найдено</li>
          )}
          {shown.map((c) => {
            const otherP = otherOf(c, me.id);
            const other = otherP.name;
            const last = c.messages[c.messages.length - 1];
            const unread = unreadIn(c, me.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => (selecting ? toggle(c.id) : setSelected(c.id))}
                  role={selecting ? "checkbox" : undefined}
                  aria-checked={selecting ? picked.has(c.id) : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 ${
                    (selecting ? picked.has(c.id) : c.id === selected) ? "bg-indigo-50" : ""
                  }`}
                >
                  {selecting && (
                    <span
                      aria-hidden
                      className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                        picked.has(c.id) ? "border-indigo-600 bg-indigo-600 text-white" : "border-stone-400 bg-white"
                      }`}
                    >
                      {picked.has(c.id) && <FiCheck className="size-3.5" strokeWidth={3} />}
                    </span>
                  )}
                  <Avatar name={other} src={avatarOf(otherP.id)} className="size-10 shrink-0 text-base" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-stone-900">{other}</span>
                      {last && <span className="shrink-0 text-xs text-stone-400">{time(last.at)}</span>}
                    </span>
                    <span className="block truncate text-sm text-stone-500">{previewOf(last) || "Нет сообщений"}</span>
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
        {selecting && (
          <div className="border-t border-stone-200 p-3">
            {listError && <p role="alert" className="mb-2 text-xs text-rose-600">{listError}</p>}
            <p className="mb-2 text-sm text-stone-600" aria-live="polite">
              {pickedCount > 0 ? `Выбрано чатов: ${pickedCount}` : "Выберите чаты"}
            </p>
            {confirmDel ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={removePicked} className="!bg-rose-600 !px-3 !py-1.5 text-sm hover:!bg-rose-700">
                  Да, удалить
                </Button>
                <Button variant="outline" onClick={() => setConfirmDel(false)} className="!px-3 !py-1.5 text-sm">
                  Отмена
                </Button>
                <span className="text-xs text-stone-500">Удалится только у вас</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={toggleAll} disabled={shown.length === 0} className="!px-3 !py-1.5 text-sm">
                  {allShownPicked ? "Снять выделение" : "Выбрать все"}
                </Button>
                <Button
                  onClick={() => setConfirmDel(true)}
                  disabled={pickedCount === 0}
                  className="!bg-rose-600 !px-3 !py-1.5 text-sm hover:!bg-rose-700 disabled:!opacity-50"
                >
                  <FiTrash2 /> Удалить
                </Button>
              </div>
            )}
          </div>
        )}
      </aside>

      <section className="chat-pane flex-col">
        {conv ? (
          <ChatPane key={conv.id} conv={conv} meId={me.id} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-stone-500">
            Выберите диалог слева
          </div>
        )}
      </section>
    </div>
  );
}

/** Карточка книги внутри переписки: часть истории, хранит название/автора/обложку на момент отправки. */
function BookRefCard({ m, mine }: { m: BookRefMessage; mine: boolean }) {
  return (
    <div className={`w-64 max-w-[85%] ${mine ? "text-right" : "text-left"}`}>
      <p className="mb-1 text-xs text-stone-500">Интересует эта книга</p>
      <div className="flex gap-3 rounded-xl bg-white p-2.5 text-left shadow-sm ring-1 ring-stone-200">
        {m.book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.book.coverUrl} alt="" className="h-16 w-12 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
            <FiBook className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900">{m.book.title}</p>
          <p className="truncate text-xs text-stone-500">{m.book.author}</p>
          <Link href={`/book/${m.bookId}`} className="mt-1 inline-block text-xs font-medium text-indigo-700 hover:underline">
            Посмотреть книгу
          </Link>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-stone-400">{time(m.at)}</p>
    </div>
  );
}

function ChatPane({ conv, meId, onBack }: { conv: Conversation; meId: string; onBack: () => void }) {
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const otherP = otherOf(conv, meId);
  const other = otherP.name;
  const count = conv.messages.length;

  useEffect(() => {
    try {
      markSeen(conv.id);
    } catch {
      /* нет доступа — ничего не меняем */
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conv.id, count]);

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
    try {
      sendMessage(conv.id, text);
      setText("");
      setSendError("");
    } catch (e) {
      if (!(e instanceof ChatAccessError)) throw e;
      setSendError(e.message); // сообщение не отправлено, данные не изменены
    }
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
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden bg-stone-50 px-3 py-4 sm:px-4">
        {count === 0 && (
          <p className="py-8 text-center text-sm text-stone-500">
            Сообщений пока нет. Напишите первое.
          </p>
        )}
        {items.map(({ m, newDay }) => {
          const mineMsg = m.from === meId;
          return (
            <div key={m.id}>
              {newDay && (
                <p className="my-3 text-center text-xs text-stone-400">{dayLabel(m.at)}</p>
              )}
              <div className={`flex ${mineMsg ? "justify-end" : "justify-start"}`}>
                {isBookRef(m) ? (
                  <BookRefCard m={m} mine={mineMsg} />
                ) : (
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
                )}
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
        {sendError && (
          <p role="alert" className="mt-2 text-xs text-rose-600">{sendError}</p>
        )}
        <p className="mt-2 text-[11px] text-stone-400">
          Сообщения хранятся только в этом браузере.
        </p>
      </div>
    </>
  );
}
