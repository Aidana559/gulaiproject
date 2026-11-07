"use client";

import { useCallback, useEffect, useState } from "react";
import { isMutedNow, muteLabel } from "@/lib/mute";
import { useToast } from "./useToast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
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
      <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Имя</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Mute</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => {
              const muted = isMutedNow(u);
              return (
                <tr key={u.id} className={muted ? "bg-amber-50/50" : ""}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-stone-600">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    {muted ? (
                      <div>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          mute · {muteLabel(u)}
                        </span>
                        {u.muteReason && (
                          <p className="mt-1 text-xs text-stone-500">{u.muteReason}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "user" &&
                      (muted ? (
                        <button
                          type="button"
                          className="mq-btn"
                          disabled={busy}
                          onClick={() => send({ id: u.id, muted: false }, "Mute снят")}
                        >
                          Снять mute
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mq-btn mq-btn-danger"
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
            {loaded && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  Пользователей нет
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