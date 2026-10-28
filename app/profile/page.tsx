"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const ROLES = { admin: "Администратор", moderator: "Модератор", user: "Пользователь" };

const STATUS = {
  reserved: { label: "Забронирована", cls: "bg-amber-100 text-amber-800" },
  given: { label: "Отдана", cls: "bg-teal-100 text-teal-800" },
  cancelled: { label: "Отменена", cls: "bg-slate-200 text-slate-600" },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      {/* Ақпарат */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-800 text-2xl font-semibold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
            <p className="text-sm text-slate-600">{ROLES[user.role]}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Выйти
          </button>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900">{user.email}</dd>
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
    </main>
  );
}