"use client";

import UserLink from "@/components/UserLink";
import { useCallback, useEffect, useState } from "react";
import { isMutedNow, muteLabel } from "@/lib/mute";
import SortableTh from "./SortableTh";
import UserListToolbar from "./UserListToolbar";
import { useToast } from "./useToast";
import { useUserListView } from "./useUserListView";
import { ROLE_LABEL, type StatusFilter, type UserSortField } from "@/lib/user-sort";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  muted?: boolean;
  mutedUntil?: string | null;
  muteReason?: string;
  blocked?: boolean;
};

const TERMS = [
  { label: "1 день", days: 1 },
  { label: "7 дней", days: 7 },
  { label: "30 дней", days: 30 },
  { label: "Навсегда", days: 0 },
];

// В панели модератора статус — это только mute (блокировка здесь не отображается).
const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "muted", label: "С mute" },
  { key: "active", label: "Без mute" },
];

const SORT_FIELD_LIST: UserSortField[] = ["name", "email", "createdAt", "role", "status"];

const rowBtn =
  "rounded-full px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:opacity-40";

const isMutedActive = (u: { muted?: boolean; mutedUntil?: string | null }) => isMutedNow(u);

const formatDate = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString("ru-RU") : "—";
};

const REASONS = [
  "Спам в объявлениях",
  "Нарушение правил публикации",
  "Недостоверная информация",
  "Оскорбления",
];

export default function MutePanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState<UserRow | null>(null);
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();
  // Поиск, фильтры и сортировка — только отображение; users и данные на сервере не меняются.
  const view = useUserListView(users, { isMuted: isMutedActive, showBlocked: false });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = res.ok ? await res.json() : { users: [] };
      setUsers(Array.isArray(json?.users) ? json.users : []);
    } catch {
      setUsers([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      toast(res.ok ? okMsg : (json.error ?? "Ошибка"));
    } catch {
      toast("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
    setTarget(null);
    setReason("");
    setCustom("");
    await load();
  }

  function applyMute() {
    if (!target) return;
    const note = [reason, custom.trim()].filter(Boolean).join(". ");
    send(
      { id: target.id, muted: true, muteDays: days || null, muteReason: note },
      "Пользователь замьючен",
    );
  }

  return (
    <>
      <UserListToolbar
        view={view}
        idPrefix="mod-users"
        searchPlaceholder="Поиск по имени, email или ID"
        statusOptions={STATUS_OPTIONS}
        sortFields={SORT_FIELD_LIST}
        total={users.length}
        loaded={loaded}
      />

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
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
            {view.rows.map((u) => {
              const muted = isMutedNow(u);
              return (
                <tr key={u.id} className="transition hover:bg-stone-50/70">
                  <td className="px-3 py-3 font-medium text-stone-900">
                    <UserLink userId={u.id}>{u.name}</UserLink>
                    <p className="mt-0.5 font-mono text-[11px] font-normal text-stone-400" title={u.id}>
                      ID {String(u.id).slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-stone-600">{u.email}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-stone-500">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-3 text-stone-700">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</td>
                  <td className="px-3 py-3">
                    {muted ? (
                      <div>
                        <span className="inline-flex items-center gap-2 text-sm text-amber-700">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Mute · {muteLabel(u)}
                        </span>
                        {u.muteReason && (
                          <p className="mt-0.5 pl-3.5 text-xs text-stone-500">{u.muteReason}</p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm text-stone-600">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Активен
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {u.role === "user" &&
                      (muted ? (
                        <button
                          type="button"
                          className={rowBtn}
                          disabled={busy}
                          onClick={() => send({ id: u.id, muted: false }, "Mute снят")}
                        >
                          Снять mute
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${rowBtn} hover:!bg-rose-50 hover:!text-rose-700`}
                          disabled={busy}
                          onClick={() => setTarget(u)}
                        >
                          Mute…
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
            {loaded && view.rows.length === 0 && (
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

      {target && (
        <div className="mq-overlay" onClick={() => setTarget(null)}>
          <div className="mq-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="mq-dialog-title">Mute: {target.name}</h2>
            <p className="mq-dialog-hint">
              Пользователь сможет пользоваться сайтом, но не сможет публиковать объявления.
            </p>

            <label className="mq-label">Срок</label>
            <div className="mq-terms">
              {TERMS.map((t) => (
                <button
                  key={t.days}
                  type="button"
                  className={`mq-term${days === t.days ? " mq-term-active" : ""}`}
                  onClick={() => setDays(t.days)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="mq-label">Причина</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mq-input">
              <option value="">— выберите причину —</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Своё пояснение (необязательно)"
              maxLength={200}
              className="mq-input"
            />

            <div className="mq-reject-btns">
              <button
                type="button"
                className="mq-btn mq-btn-danger"
                disabled={busy || (!reason && !custom.trim())}
                onClick={applyMute}
              >
                Замьютить
              </button>
              <button type="button" className="mq-btn" onClick={() => setTarget(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </>
  );
}