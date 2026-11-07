"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/FormField";
import PageTitle from "@/components/staff/PageTitle";
import { useToast } from "@/components/staff/useToast";

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

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = res.ok ? await res.json() : [];
      // API отдаёт { users: [...] } — берём массив, не весь объект
      setUsers(Array.isArray(json) ? json : Array.isArray(json?.users) ? json.users : []);
    } catch {
      setUsers([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
        toast(json.error ?? "Ошибка");
        return;
      }
      toast(okMsg);
      await loadUsers();
    } catch {
      toast("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(u: UserRow) {
    if (!confirm(`Удалить пользователя «${u.name}» (${u.email})? Это действие нельзя отменить.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error ?? "Не удалось удалить");
        return;
      }
      toast("Пользователь удалён");
      await loadUsers();
    } catch {
      toast("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Пользователи" hint="Роли, блокировка, mute и удаление." />

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
              const self = String(u.id) === String(user?.id);
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
                            patchUser(u.id, { muted: !u.muted }, u.muted ? "Mute снят" : "Mute")
                          }
                        >
                          {u.muted ? "Unmute" : "Mute"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => removeUser(u)}
                        >
                          Удалить
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {loaded && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  Пользователей нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {toastNode}
    </>
  );
}