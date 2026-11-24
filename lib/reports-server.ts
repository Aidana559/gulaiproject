// Серверные помощники для жалоб: общая блокировка, приведение старых записей и закрытие жалоб по объекту.
import { readJson, withLock, writeJson } from "./db";
import { isHistoryStatus, normalizeStatus, statusForDecision } from "./reports";
import type { Report, ReportDecision, ReportTargetType } from "./types";

export const REPORTS_FILE = "reports.json";

/** Один общий замок на все изменения жалоб (и в /api/reports, и при удалении книги автором). */
export const withReportsLock = <T>(fn: () => Promise<T>) => withLock("reports", fn);

/**
 * Приводит старые записи (только книги, статусы open/closed, нет данных о рассмотрении) к текущему формату.
 * Ничего не теряет: у уже рассмотренных жалоб без даты берём updatedAt/createdAt, имя — из handledBy.
 */
export function normalizeReport(r: Report): Report {
  const status = normalizeStatus(r.status);
  const out: Report = {
    ...r,
    targetType: r.targetType ?? "book",
    targetId: r.targetId || r.bookId || "",
    status,
  };
  if (isHistoryStatus(status) && !out.handledAt) out.handledAt = r.updatedAt ?? r.createdAt;
  return out;
}

type ActorInfo = { id?: string | null; name: string; role: "admin" | "moderator" | "user" | "system" };

/** Фиксирует решение в жалобе: статус, кто/когда/что решил и запись в журнал. Меняет объект на месте. */
export function applyDecision(r: Report, decision: ReportDecision, by: ActorInfo, note?: string, closedWith?: string) {
  const from = normalizeStatus(r.status);
  const to = statusForDecision(decision);
  const now = new Date().toISOString();
  r.status = to;
  r.decision = decision;
  r.decisionNote = note || undefined;
  r.handledBy = by.name;
  r.handledById = by.id ?? undefined;
  r.handledByRole = by.role;
  r.handledAt = now;
  r.updatedAt = now;
  if (closedWith) r.closedWithReportId = closedWith;
  (r.trail ??= []).push({
    at: now,
    byId: by.id ?? null,
    byName: by.name,
    byRole: by.role,
    from,
    to,
    decision,
    note: note || undefined,
  });
}

/**
 * Закрывает все ещё не рассмотренные жалобы на объект (например, когда автор сам удалил книгу).
 * Жалобы НЕ удаляются: они уходят в «Историю» с решением и сведениями о том, кто и когда их закрыл.
 */
export async function closeReportsForTarget(
  targetType: ReportTargetType,
  targetId: string,
  decision: ReportDecision,
  by: ActorInfo,
  note?: string,
): Promise<number> {
  return withReportsLock(async () => {
    const reports = (await readJson<Report[]>(REPORTS_FILE, [])).map(normalizeReport);
    let n = 0;
    for (const r of reports) {
      if (r.targetType !== targetType || r.targetId !== String(targetId)) continue;
      if (isHistoryStatus(r.status)) continue;
      applyDecision(r, decision, by, note);
      n++;
    }
    if (n) await writeJson(REPORTS_FILE, reports);
    return n;
  });
}
