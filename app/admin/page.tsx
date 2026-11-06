"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/Button";
import { categoryLabels, genres, type Category } from "@/data/books";
import { inputClass } from "@/components/FormField";

type Role = "admin" | "moderator" | "user";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  blocked?: boolean;
  muted?: boolean;
  createdAt?: string;
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  user: "Пользователь",
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"users" | "catalog">("users");
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [newGenre, setNewGenre] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const json = await res.json();
      // API отдаёт { users: [...] } — берём массив, не весь объект
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json?.users)
          ? json.users
          : [];
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "admin") {
      router.replace("/");
      return;
    }
    loadUsers();
    try {
      setCustomGenres(JSON.parse(localStorage.getItem("p2p-custom-genres") ?? "[]"));
    } catch {
      /* */
    }
  }, [user, loading, router, loadUsers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q),
    );
  }, [users, query]);

  async function patchUser(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(json.error ?? "Ошибка");
        return;
      }
      setToast(okMsg);
      await loadUsers();
    } catch {
      setToast("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  function addGenre() {
    const g = newGenre.trim();
    if (!g) return;
    const next = Array.from(new Set([...customGenres, g]));
    setCustomGenres(next);
    localStorage.setItem("p2p-custom-genres", JSON.stringify(next));
    setNewGenre("");
    setToast("Жанр добавлен (локально)");
  }

  function removeGenre(g: string) {
    const next = customGenres.filter((x) => x !== g);
    setCustomGenres(next);
    localStorage.setItem("p2p-custom-genres", JSON.stringify(next));
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center text-stone-500">Загрузка…</main>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-stone-900">Админка</h1>
      <p className="mt-2 text-stone-500">Пользователи, роли, блокировка и справочники.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant={tab === "users" ? "primary" : "outline"} onClick={() => setTab("users")}>
          Пользователи
        </Button>
        <Button
          size="sm"
          variant={tab === "catalog" ? "primary" : "outline"}
          onClick={() => setTab("catalog")}
        >
          Категории и жанры
        </Button>
      </div>

      {tab === "users" && (
        <>
          <div className="mt-6">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, email, роли"
              className={inputClass}
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Имя</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((u) => {
                  const self = String(u.id) === String(user.id);
                  return (
                    <tr
                      key={u.id}
                      className={u.blocked ? "bg-rose-50/40" : u.muted ? "bg-amber-50/40" : ""}
                    >
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {u.name}
                        {self && <span className="ml-2 text-xs text-stone-400">(вы)</span>}
                      </td>
                      <td className="px-4 py-3 text-stone-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          disabled={self || busy}
                          value={u.role}
                          onChange={(e) =>
                            patchUser(
                              u.id,
                              { role: e.target.value },
                              `Роль: ${ROLE_LABEL[e.target.value as Role]}`,
                            )
                          }
                          className="rounded-lg border border-stone-300 px-2 py-1 text-sm"
                        >
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.blocked && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                              blocked
                            </span>
                          )}
                          {u.muted && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              mute
                            </span>
                          )}
                          {!u.blocked && !u.muted && (
                            <span className="text-xs text-stone-400">активен</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {!self && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={u.blocked ? "outline" : "danger"}
                              disabled={busy}
                              onClick={() =>
                                patchUser(
                                  u.id,
                                  { blocked: !u.blocked },
                                  u.blocked ? "Разблокирован" : "Заблокирован",
                                )
                              }
                            >
                              {u.blocked ? "Разблок." : "Блок"}
                            </Button>
                            <Button
                              size="sm"
                              variant={u.muted ? "outline" : "danger"}
                              disabled={busy}
                              onClick={() =>
                                patchUser(
                                  u.id,
                                  { muted: !u.muted },
                                  u.muted ? "Mute снят" : "Mute",
                                )
                              }
                            >
                              {u.muted ? "Unmute" : "Mute"}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      Пользователей нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "catalog" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Категории</h2>
            <ul className="mt-4 space-y-2">
              {(Object.keys(categoryLabels) as Category[]).map((c) => (
                <li
                  key={c}
                  className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-stone-800">{categoryLabels[c]}</span>
                  <span className="text-xs text-stone-400">{c}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Жанры</h2>
            <ul className="mt-4 space-y-2">
              {genres.map((g) => (
                <li key={g} className="rounded-lg bg-stone-50 px-4 py-2.5 text-sm text-stone-800">
                  {g}
                </li>
              ))}
              {customGenres.map((g) => (
                <li
                  key={g}
                  className="flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-indigo-900">{g}</span>
                  <button
                    type="button"
                    onClick={() => removeGenre(g)}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <input
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                placeholder="Новый жанр"
                className={inputClass}
              />
              <Button size="sm" onClick={addGenre}>
                Добавить
              </Button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
