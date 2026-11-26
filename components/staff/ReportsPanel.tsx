"use client";

import UserLink from "@/components/UserLink";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiSearch, FiX } from "react-icons/fi";
import { Button } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";
import {
  CURRENT_STATUSES,
  DECISIONS,
  DECISION_LABEL,
  DECISION_SHORT,
  DECISION_STYLE,
  HISTORY_STATUSES,
  NOTE_MAX,
  ROLE_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  TARGET_LABEL,
  decisionsForTarget,
  isHistoryStatus,
} from "@/lib/reports";
import type { ReportDecision, ReportStatus, ReportTargetType } from "@/lib/types";
import ModerationDialog, { type ModerationPayload } from "./ModerationDialog";
import { useToast } from "./useToast";

type ReportRow = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  comment?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt?: string;
  reporterName?: string;
  reporterId?: string;
  targetExists?: boolean;
  sameTargetCount?: number;
  bookTitle?: string;
  reviewText?: string;
  reviewAuthor?: string;
  userName?: string;
  bookId?: string;
  
  handledBy?: string;
  handledByRole?: string;
  handledAt?: string;
  decision?: ReportDecision;
  decisionNote?: string;
  inReviewBy?: string;
  inReviewAt?: string;
  closedWithReportId?: string;
};

type Tab = "current" | "history";
type Sort = "new" | "old" | "created_new" | "created_old";

const POLL_MS = 20_000;

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("ru-RU") : "—");
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/ё/g, "е");


function targetTitle(r: ReportRow) {
  if (r.targetType === "book") return r.bookTitle ?? "";
  if (r.targetType === "review") return `${r.reviewAuthor ?? ""} ${r.reviewText ?? ""} ${r.bookTitle ?? ""}`;
  return r.userName ?? "";
}

const selectCls = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";


export default function ReportsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("current");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReportTargetType | "all">("all");
  const [decisionFilter, setDecisionFilter] = useState<ReportDecision | "all">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [decide, setDecide] = useState<ReportRow | null>(null);
  
  const [bookAction, setBookAction] = useState<{ report: ReportRow; decision: ReportDecision; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const json = res.ok ? await res.json() : null;
      if (Array.isArray(json)) setReports(json);
    } catch {
      /* оставляем то, что уже загружено */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  
  useEffect(() => {
    setStatusFilter("all");
    setDecisionFilter("all");
    setSort("new");
  }, [tab]);

  
  async function patch(body: Record<string, unknown>, okMsg: string): Promise<boolean> {
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (json.report) {
        setReports((prev) => prev.map((x) => (x.id === json.report.id ? { ...x, ...json.report } : x)));
      }
      if (!res.ok) {
        toast(json.error ?? "Ошибка");
        load();
        return false;
      }
      toast(okMsg);
      load(); 
      return true;
    } catch {
      toast("Нет связи с сервером");
      return false;
    }
  }

  const take = (r: ReportRow) => patch({ id: r.id, action: "take" }, "Жалоба взята в работу");
  const reopen = (r: ReportRow) => {
    if (!confirm("Вернуть жалобу в «Текущие»? Прежнее решение сохранится в журнале.")) return;
    return patch({ id: r.id, action: "reopen" }, "Жалоба возвращена в работу");
  };

  async function submitDecision(r: ReportRow, decision: ReportDecision, note: string) {
    if (decision === "book_hidden" || decision === "book_deleted") {
      
      setDecide(null);
      setBookAction({ report: r, decision, note });
      return;
    }
    setBusy(true);
    const ok = await patch({ id: r.id, action: "resolve", decision, note }, "Жалоба рассмотрена и перенесена в историю");
    setBusy(false);
    if (ok) setDecide(null); 
  }

  async function moderateBook(p: ModerationPayload) {
    if (!bookAction) return;
    const { report, decision, note } = bookAction;
    setBusy(true);
    try {
      const url = `/api/books/${report.targetId}`;
      const res =
        decision === "book_deleted"
          ? await fetch(url, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: p.reason }),
            })
          : await fetch(url, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hidden: true, reason: p.reason, hideDays: p.hideDays, hiddenUntil: p.hiddenUntil }),
            });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(json.error ?? "Не удалось выполнить действие над книгой");
        return;
      }
      const reasonNote = [note, p.reason && `Причина для автора: ${p.reason}`].filter(Boolean).join(" · ").slice(0, NOTE_MAX);
      await patch(
        { id: report.id, action: "resolve", decision, note: reasonNote },
        decision === "book_deleted" ? "Книга удалена, жалоба перенесена в историю" : "Книга скрыта, жалоба перенесена в историю",
      );
      setBookAction(null);
    } finally {
      setBusy(false);
    }
  }

  
  const current = useMemo(() => reports.filter((r) => !isHistoryStatus(r.status)), [reports]);
  const history = useMemo(() => reports.filter((r) => isHistoryStatus(r.status)), [reports]);
  const base = tab === "current" ? current : history;

  const visible = useMemo(() => {
    const q = norm(search.trim());
    const list = base.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.targetType !== typeFilter) return false;
      if (decisionFilter !== "all" && r.decision !== decisionFilter) return false;
      if (!q) return true;
      const hay = norm(
        [
          r.reason,
          r.comment,
          targetTitle(r),
          r.reporterName,
          r.handledBy,
          r.decision ? DECISION_LABEL[r.decision] : "",
          r.decisionNote,
          TARGET_LABEL[r.targetType],
          STATUS_LABEL[r.status],
        ].join(" "),
      );
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    const t = (r: ReportRow, byCreated: boolean) =>
      new Date(byCreated ? r.createdAt : (r.handledAt ?? r.updatedAt ?? r.createdAt)).getTime() || 0;
    const byCreated = tab === "current" || sort === "created_new" || sort === "created_old";
    const dir = sort === "old" || sort === "created_old" ? 1 : -1;
    return [...list].sort((a, b) => dir * (t(a, byCreated) - t(b, byCreated)));
  }, [base, search, statusFilter, typeFilter, decisionFilter, sort, tab]);

  const statusOptions = tab === "current" ? CURRENT_STATUSES : HISTORY_STATUSES;
  const newCount = reports.filter((r) => r.status === "new").length;
  const filtersActive = !!search || statusFilter !== "all" || typeFilter !== "all" || decisionFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDecisionFilter("all");
  }

  const tabBtn = (key: Tab, label: string, n: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        tab === key ? "bg-indigo-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-100"
      }`}
    >
      {label} <span className={tab === key ? "text-indigo-100" : "text-stone-400"}>({n})</span>
    </button>
  );

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Жалобы" className="inline-flex gap-1 rounded-full bg-white p-1 ring-1 ring-stone-200">
          {tabBtn("current", "Текущие", current.length)}
          {tabBtn("history", "История", history.length)}
        </div>
        {loaded && tab === "current" && (
          <p className="text-sm text-stone-500">
            Новых: <b className="text-stone-800">{newCount}</b> · на рассмотрении:{" "}
            <b className="text-stone-800">{current.length - newCount}</b>
          </p>
        )}
        {loaded && tab === "history" && (
          <p className="text-sm text-stone-500">Рассмотренные жалобы хранятся здесь вместе с решением.</p>
        )}
      </div>

      
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: книга, отзыв, пользователь, причина, кто рассмотрел…"
            aria-label="Поиск по жалобам"
            className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-9 pr-3 text-sm"
          />
        </label>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReportStatus | "all")}
          aria-label="Статус"
          className={selectCls}
        >
          <option value="all">Все статусы</option>
          {statusOptions.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]} ({base.filter((r) => r.status === st).length})
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ReportTargetType | "all")}
          aria-label="Тип объекта"
          className={selectCls}
        >
          <option value="all">Все объекты</option>
          {(Object.keys(TARGET_LABEL) as ReportTargetType[]).map((t) => (
            <option key={t} value={t}>
              {TARGET_LABEL[t]}
            </option>
          ))}
        </select>

        {tab === "history" && (
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as ReportDecision | "all")}
            aria-label="Решение"
            className={selectCls}
          >
            <option value="all">Все решения</option>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {DECISION_SHORT[d]}
              </option>
            ))}
          </select>
        )}

        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка по дате" className={selectCls}>
          {tab === "current" ? (
            <>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
            </>
          ) : (
            <>
              <option value="new">Рассмотрены: сначала новые</option>
              <option value="old">Рассмотрены: сначала старые</option>
              <option value="created_new">Подача: сначала новые</option>
              <option value="created_old">Подача: сначала старые</option>
            </>
          )}
        </select>

        {filtersActive && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <FiX /> Сбросить
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {!loaded && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">Загрузка…</li>
        )}
        {loaded && visible.length === 0 && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            {filtersActive
              ? "Ничего не найдено — измените поиск или фильтры"
              : tab === "current"
                ? "Текущих жалоб нет"
                : "В истории пока пусто"}
          </li>
        )}
        {visible.map((r) => {
          const done = isHistoryStatus(r.status);
          return (
            <li key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    {done && r.decision && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${DECISION_STYLE[r.decision]}`}
                      >
                        {DECISION_SHORT[r.decision]}
                      </span>
                    )}
                    <span className="text-xs font-medium uppercase text-stone-400">{TARGET_LABEL[r.targetType]}</span>
                    {(r.sameTargetCount ?? 1) > 1 && (
                      <span className="text-xs text-stone-400">· жалоб на этот объект: {r.sameTargetCount}</span>
                    )}
                  </div>

                  {r.targetType === "book" && (
                    <div className="mt-1">
                      {r.targetExists ? (
                        <Link href={`/book/${r.targetId}`} className="font-semibold text-indigo-700 hover:underline">
                          {r.bookTitle}
                        </Link>
                      ) : (
                        <p className="font-semibold text-stone-900">
                          {r.bookTitle} <span className="text-xs font-normal text-stone-400">(книги больше нет в каталоге)</span>
                        </p>
                      )}
                    </div>
                  )}
                  {r.targetType === "review" && (
                    <div className="mt-1">
                      <p className="font-semibold text-stone-900">
                        {r.reviewAuthor ? `Отзыв от ${r.reviewAuthor}` : "Отзыв (удалён)"}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">«{r.reviewText}»</p>
                      {r.bookId && (
                        <Link href={`/book/${r.bookId}`} className="text-sm text-indigo-600 hover:underline">
                          к книге {r.bookTitle}
                        </Link>
                      )}
                    </div>
                  )}
                  {r.targetType === "user" && <p className="mt-1 font-semibold text-stone-900"><UserLink userId={r.targetId}>{r.userName}</UserLink></p>}

                  <p className="mt-2 text-sm text-stone-700">
                    <b>Причина:</b> {r.reason}
                  </p>
                  {r.comment && (
                    <p className="mt-1 text-sm text-stone-600">
                      <b>Комментарий:</b> {r.comment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-stone-400">
                    От <UserLink userId={r.reporterId}>{r.reporterName}</UserLink> · {fmt(r.createdAt)}
                  </p>
                  {!done && r.status === "in_review" && r.inReviewBy && (
                    <p className="mt-1 text-xs text-amber-700">
                      В работе: {r.inReviewBy}
                      {r.inReviewAt && ` · с ${fmt(r.inReviewAt)}`}
                    </p>
                  )}

                  {done && (
                    <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm ring-1 ring-stone-200">
                      <p className="text-stone-800">
                        <b>Решение:</b>{" "}
                        {r.decision ? DECISION_LABEL[r.decision] : `${STATUS_LABEL[r.status]} (решение не было зафиксировано)`}
                      </p>
                      <p className="mt-1 text-stone-600">
                        <b>Рассмотрел(а):</b> {r.handledBy ?? "не указано"}
                        {r.handledByRole && ROLE_LABEL[r.handledByRole] ? ` (${ROLE_LABEL[r.handledByRole]})` : ""}
                      </p>
                      <p className="mt-1 text-stone-600">
                        <b>Когда:</b> {fmt(r.handledAt ?? r.updatedAt ?? r.createdAt)}
                      </p>
                      {r.decisionNote && (
                        <p className="mt-1 text-stone-600">
                          <b>Комментарий:</b> {r.decisionNote}
                        </p>
                      )}
                      {r.closedWithReportId && (
                        <p className="mt-1 text-xs text-stone-400">Закрыта вместе с другой жалобой на тот же объект.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!done && r.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => take(r)}>
                      Взять в работу
                    </Button>
                  )}
                  {!done && (
                    <Button size="sm" onClick={() => setDecide(r)}>
                      Рассмотреть
                    </Button>
                  )}
                  {done && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => reopen(r)}>
                      Вернуть в работу
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {decide && (
        <DecisionDialog
          report={decide}
          busy={busy}
          onSubmit={(d, note) => submitDecision(decide, d, note)}
          onClose={() => setDecide(null)}
        />
      )}
      {bookAction && (
        <ModerationDialog
          mode={bookAction.decision === "book_deleted" ? "delete" : "hide"}
          bookTitle={bookAction.report.bookTitle || "книга"}
          busy={busy}
          onSubmit={moderateBook}
          onClose={() => setBookAction(null)}
        />
      )}
      {toastNode}
    </>
  );
}


function DecisionDialog({
  report,
  busy,
  onSubmit,
  onClose,
}: {
  report: ReportRow;
  busy: boolean;
  onSubmit: (d: ReportDecision, note: string) => void;
  onClose: () => void;
}) {
  const options = decisionsForTarget(report.targetType).filter((d) => {
    
    if (d === "book_hidden" || d === "book_deleted" || d === "review_deleted") return !!report.targetExists;
    return true;
  });
  const [decision, setDecision] = useState<ReportDecision | "">("");
  const [note, setNote] = useState("");

  const next = decision === "book_hidden" || decision === "book_deleted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Решение по жалобе"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-stone-900">Решение по жалобе</h2>
        <p className="mt-1 text-sm text-stone-500">
          {TARGET_LABEL[report.targetType]}: {targetTitle(report).trim() || "—"} · причина: {report.reason}
        </p>

        <fieldset className="mt-4 space-y-2">
          {options.map((d) => (
            <label
              key={d}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ${
                decision === d ? "bg-indigo-50 ring-indigo-400" : "ring-stone-200 hover:bg-stone-50"
              }`}
            >
              <input type="radio" name="decision" checked={decision === d} onChange={() => setDecision(d)} />
              <span className="text-stone-800">{DECISION_LABEL[d]}</span>
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-stone-700">Комментарий (необязательно)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="Для истории: почему принято такое решение"
        />
        <p className="mt-1 text-xs text-stone-400">
          Жалоба сразу перейдёт в «Историю»: сохранятся ваше имя, время и решение.
          {next && " Дальше нужно указать причину для автора книги."}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" disabled={!decision || busy} onClick={() => decision && onSubmit(decision, note.trim())}>
            {next ? "Далее" : "Принять решение"}
          </Button>
        </div>
      </div>
    </div>
  );
}
