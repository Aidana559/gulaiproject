"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

type U = { id: string | number; name: string; email?: string; role: string; blocked?: boolean };
type G = { id: string; name: string; type: "genre" | "category" };

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [genres, setGenres] = useState<G[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"genre" | "category">("genre");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setUsers(await api("/api/admin/users", user.id));
      setGenres(await api("/api/genres"));
    } catch (e: any) {
      setError(e.message);
    }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (!user || user.role !== "admin") return <p className="p-6">Доступ только для администратора.</p>;

  async function patchUser(id: string | number, body: object) {
    try {
      await api("/api/admin/users", user!.id, { method: "PATCH", body: JSON.stringify({ id, ...body }) });
      load();
    } catch (e: any) { alert(e.message); }
  }
  async function addGenre(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/genres", user!.id, { method: "POST", body: JSON.stringify({ name, type }) });
      setName(""); load();
    } catch (e: any) { alert(e.message); }
  }
  async function delGenre(id: string) {
    await api(`/api/genres?id=${id}`, user!.id, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <h1 className="text-2xl font-semibold">Панель администратора</h1>
      {error && <p className="text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-xl font-semibold">Пользователи</h2>
        <div className="overflow-x-auto">
          <table className="w-full border text-left text-sm">
            <thead className="bg-gray-100">
              <tr><th className="p-2">Имя</th><th className="p-2">Email</th><th className="p-2">Роль</th><th className="p-2">Статус</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = String(u.id) === String(user.id);
                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">
                      <select disabled={self} value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })} className="rounded border p-1">
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="p-2">{u.blocked ? "Заблокирован" : "Активен"}</td>
                    <td className="p-2">
                      {!self && (
                        <button onClick={() => patchUser(u.id, { blocked: !u.blocked })} className="rounded border px-2 py-1">
                          {u.blocked ? "Разблокировать" : "Заблокировать"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Жанры и категории</h2>
        <form onSubmit={addGenre} className="mb-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Название" className="flex-1 rounded border p-2" />
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded border p-2">
            <option value="genre">Жанр</option>
            <option value="category">Категория</option>
          </select>
          <button className="rounded bg-black px-4 text-white">Добавить</button>
        </form>
        <ul className="space-y-1">
          {genres.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded border px-3 py-1">
              <span>{g.name} <span className="text-xs text-gray-500">({g.type === "genre" ? "жанр" : "категория"})</span></span>
              <button onClick={() => delGenre(g.id)} className="text-red-600">Удалить</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}