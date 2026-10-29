"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "moderator" | "user";
  createdAt: string;
};

type Booking = {
  id: string;
  bookTitle: string;
  bookAuthor: string;
  status: "reserved" | "given" | "cancelled";
  createdAt: string;
};

type Draft = { name: string; email: string; telegram: string; bio: string; avatar: string | null };
type FieldErrors = Partial<Record<keyof Draft, string>>;

const ROLES = { admin: "Администратор", moderator: "Модератор", user: "Пользователь" };

const STATUS = {
  reserved: { label: "Забронирована", cls: "bg-amber-100 text-amber-800" },
  given: { label: "Отдана", cls: "bg-teal-100 text-teal-800" },
  cancelled: { label: "Отменена", cls: "bg-slate-200 text-slate-600" },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

// Обрезает фото до квадрата 256x256, чтобы оно не весило много
function resizeImage(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const min = Math.min(img.width, img.height);
      canvas
        .getContext("2d")!
        .drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = url;
  });
}

function validate(d: Draft): FieldErrors {
  const e: FieldErrors = {};
  if (d.name.trim().length < 2 || d.name.trim().length > 30) e.name = "От 2 до 30 символов";
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = "Введите корректную почту";
  if (d.telegram && !/^@?[a-zA-Z0-9_]{4,32}$/.test(d.telegram.trim())) e.telegram = "Например, @username";
  if (d.bio.length > 200) e.bio = "Не более 200 символов";
  return e;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, updateProfile, refresh } = useAuth();
  const [user, setUser] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  // редактирование профиля
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBookings = useCallback(async () => {
    const res = await fetch("/api/bookings");
    if (res.ok) setBookings((await res.json()).bookings);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return router.replace("/login");
        setUser((await res.json()).user);
        await loadBookings();
      })
      .catch(() => router.replace("/login"));
  }, [router, loadBookings]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh(); // чтобы шапка снова показала «Войти» и «Регистрация»
    router.replace("/login");
  }

  async function cancel(id: string) {
    await fetch(`/api/bookings/${id}`, { method: "PATCH" });
    await loadBookings();
  }

  async function addBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Ошибка");
      return;
    }
    form.reset();
    await loadBookings();
  }

  if (!user) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Загрузка…</main>;
  }

  const active = bookings.filter((b) => b.status === "reserved").length;
  const input =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25";

  // то, что показываем: данные с сервера + правки из редактирования
  const shown = {
    name: authUser?.name ?? user.name,
    email: authUser?.email ?? user.email,
    avatar: authUser?.avatar ?? null,
    telegram: authUser?.telegram ?? "",
    bio: authUser?.bio ?? "",
  };

  function startEdit() {
    setDraft({ ...shown });
    setFieldErrors({});
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFieldErrors({});
  }

  function saveEdit() {
    if (!draft) return;
    const e = validate(draft);
    setFieldErrors(e);
    if (Object.keys(e).length) return;
    updateProfile({
      name: draft.name.trim(),
      email: draft.email.trim(),
      telegram: draft.telegram.trim(),
      bio: draft.bio.trim(),
      avatar: draft.avatar,
    });
    setEditing(false);
    setToast("Профиль сохранён ✓");
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setToast("Выберите изображение");
    if (file.size > 5 * 1024 * 1024) return setToast("Файл больше 5 МБ");
    try {
      const avatar = await resizeImage(file);
      setDraft((d) => d && { ...d, avatar });
    } catch {
      setToast("Не удалось загрузить фото");
    }
  }

  const bind = (key: "name" | "email" | "telegram") => ({
    value: draft?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => d && { ...d, [key]: e.target.value }),
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      {/* Ақпарат */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={shown.name} src={shown.avatar} className="h-14 w-14 text-2xl font-semibold" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-slate-900">{shown.name}</h1>
            <p className="text-sm text-slate-600">{ROLES[user.role]}</p>
          </div>
          <div className="flex flex-col gap-2">
            {!editing && (
              <button
                onClick={startEdit}
                className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
              >
                Редактировать
              </button>
            )}
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Выйти
            </button>
          </div>
        </div>

        {!editing ? (
          <>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-900">{shown.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Дата регистрации</dt>
                <dd className="text-slate-900">{fmt(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Активных броней</dt>
                <dd className="text-slate-900">{active}</dd>
              </div>
            </dl>

            {(shown.telegram || shown.bio) && (
              <dl className="mt-3 grid gap-3 text-sm">
                {shown.telegram && (
                  <div>
                    <dt className="text-slate-500">Telegram</dt>
                    <dd className="text-slate-900">{shown.telegram}</dd>
                  </div>
                )}
                {shown.bio && (
                  <div>
                    <dt className="text-slate-500">О себе</dt>
                    <dd className="whitespace-pre-line text-slate-900">{shown.bio}</dd>
                  </div>
                )}
              </dl>
            )}
          </>
        ) : (
          draft && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-4">
                <Avatar name={draft.name} src={draft.avatar} className="h-20 w-20 text-3xl font-semibold" />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    Загрузить фото
                  </button>
                  {draft.avatar && (
                    <button
                      type="button"
                      onClick={() => setDraft((d) => d && { ...d, avatar: null })}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Удалить фото
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-600">
                  Имя пользователя
                  <input className={`${input} mt-1`} {...bind("name")} />
                  {fieldErrors.name && <span className="text-xs text-red-700">{fieldErrors.name}</span>}
                </label>
                <label className="block text-sm text-slate-600">
                  Почта
                  <input type="email" className={`${input} mt-1`} {...bind("email")} />
                  {fieldErrors.email && <span className="text-xs text-red-700">{fieldErrors.email}</span>}
                </label>
                <label className="block text-sm text-slate-600 sm:col-span-2">
                  Telegram
                  <input className={`${input} mt-1`} placeholder="@username" {...bind("telegram")} />
                  {fieldErrors.telegram && <span className="text-xs text-red-700">{fieldErrors.telegram}</span>}
                </label>
                <label className="block text-sm text-slate-600 sm:col-span-2">
                  О себе
                  <textarea
                    rows={3}
                    className={`${input} mt-1`}
                    placeholder="Что любите читать?"
                    value={draft.bio}
                    onChange={(e) => setDraft((d) => d && { ...d, bio: e.target.value })}
                  />
                  <span className={`text-xs ${draft.bio.length > 200 ? "text-red-700" : "text-slate-400"}`}>
                    {draft.bio.length}/200
                  </span>
                  {fieldErrors.bio && <span className="ml-2 text-xs text-red-700">{fieldErrors.bio}</span>}
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={cancelEdit}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
                >
                  Сохранить
                </button>
              </div>
            </div>
          )
        )}
      </section>

      {/* Брондар */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Мои брони</h2>

        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Пока нет броней. Забронируйте книгу в каталоге или добавьте бронь ниже.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-4 py-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{b.bookTitle}</p>
                  <p className="text-sm text-slate-600">
                    {b.bookAuthor || "Автор не указан"} · {fmt(b.createdAt)}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS[b.status].cls}`}>
                  {STATUS[b.status].label}
                </span>
                {b.status === "reserved" && (
                  <button
                    onClick={() => cancel(b.id)}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Отменить
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addBooking} className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_1fr_auto]">
          <input name="bookTitle" required placeholder="Название книги" className={input} />
          <input name="bookAuthor" placeholder="Автор" className={input} />
          <button
            type="submit"
            className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
          >
            Забронировать
          </button>
        </form>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}