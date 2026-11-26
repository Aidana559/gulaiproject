"use client";

import UserLink from "@/components/UserLink";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PageTitle from "@/components/staff/PageTitle";
import SortableTh from "@/components/staff/SortableTh";
import UserListToolbar from "@/components/staff/UserListToolbar";
import { useToast } from "@/components/staff/useToast";
import { useUserListView } from "@/components/staff/useUserListView";
import type { StatusFilter, UserSortField } from "@/lib/user-sort";

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

// Для таблицы админа «mute» — это флаг muted (как и в бейдже статуса ниже).
const isMutedFlag = (u: { muted?: boolean }) => !!u.muted;

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "muted", label: "Mute" },
  { key: "blocked", label: "Заблокированные" },
];

const SORT_FIELD_LIST: UserSortField[] = ["name", "email", "createdAt", "role", "status"];

const rowBtn =
  "rounded-full px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:opacity-40";

const formatDate = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString("ru-RU") : "—";
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
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = res.ok ? await res.json() : [];
      
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

  // Поиск, фильтры и сортировка — только отображение; users и данные на сервере не меняются.
  const view = useUserListView(users, { isMuted: isMutedFlag, showBlocked: true });
  const filtered = view.rows;

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
      <PageTitle title="Пользователи" hint="Роли, блокировка и mute." />

      <UserListToolbar
        view={view}
        idPrefix="admin-users"
        searchPlaceholder="Поиск по имени, email или ID"
        statusOptions={STATUS_OPTIONS}
        sortFields={SORT_FIELD_LIST}
        total={users.length}
        loaded={loaded}
      />

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 text-xs text-stone-500">
            <tr>
              <SortableTh field="name" label="Имя" sort={view.sort} onToggle={view.toggleSort} />
              <SortableTh field="email" label="Email" sort={view.sort} onToggle={view.toggleSort} />
              <SortableTh field="createdAt" label="Регистрация" sort={view.sort} onToggle={view.toggleSort} />
              <SortableTh field="role" label="Роль" sort={view.sort} onToggle={view.toggleSort} />
              <SortableTh field="status" label="Статус" sort={view.sort} onToggle={view.toggleSort} />
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map((u) => {
              const self = String(u.id) === String(user?.id);
              const status = u.blocked
                ? { label: "Заблокирован", dot: "bg-rose-500", text: "text-rose-700" }
                : u.muted
                  ? { label: "Mute", dot: "bg-amber-500", text: "text-amber-700" }
                  : { label: "Активен", dot: "bg-emerald-500", text: "text-stone-600" };
              return (
                <tr key={u.id} className="transition hover:bg-stone-50/70">
                  <td className="px-3 py-3 font-medium text-stone-900">
                    <UserLink userId={u.id}>{u.name}</UserLink>
                    {self && <span className="ml-2 text-xs font-normal text-stone-400">вы</span>}
                    <p className="mt-0.5 font-mono text-[11px] font-normal text-stone-400" title={u.id}>
                      ID {String(u.id).slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-stone-600">{u.email}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-stone-500">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    <select
                      disabled={self || busy}
                      value={u.role}
                      aria-label={`Роль: ${u.name}`}
                      onChange={(e) =>
                        patchUser(
                          u.id,
                          { role: e.target.value },
                          `Роль: ${ROLE_LABEL[e.target.value as Role]}`,
                        )
                      }
                      className="-ml-2 cursor-pointer rounded-lg bg-transparent px-2 py-1 text-sm text-stone-700 outline-none transition hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-default disabled:opacity-100 disabled:hover:bg-transparent disabled:[appearance:none]"
                    >
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-2 text-sm ${status.text}`}>
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {!self && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          className={rowBtn}
                          onClick={() =>
                            patchUser(
                              u.id,
                              { blocked: !u.blocked },
                              u.blocked ? "Разблокирован" : "Заблокирован",
                            )
                          }
                        >
                          {u.blocked ? "Разблокировать" : "Блок"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={rowBtn}
                          onClick={() =>
                            patchUser(u.id, { muted: !u.muted }, u.muted ? "Mute снят" : "Mute")
                          }
                        >
                          {u.muted ? "Снять mute" : "Mute"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={`${rowBtn} hover:!bg-rose-50 hover:!text-rose-700`}
                          onClick={() => removeUser(u)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {loaded && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-stone-500">
                  {users.length === 0 ? (
                    "Пользователей нет"
                  ) : (
                    <>
                      По выбранным параметрам пользователи не найдены.{" "}
                      <button type="button" onClick={view.resetFilters} className="font-medium text-indigo-700 underline underline-offset-4">
                        Сбросить фильтры
                      </button>
                    </>
                  )}
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