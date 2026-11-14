import Link from "next/link";
import {
  STATE_STYLE,
  actionHeadline,
  actionName,
  actorLabel,
  fmtDate,
  fmtDateTime,
  stateLabel,
  type ModerationEntry,
} from "@/lib/moderation-shared";

const ACCENT: Record<string, string> = {
  hidden: "border-amber-400",
  deleted: "border-rose-500",
  deleted_by_owner: "border-rose-300",
  published: "border-emerald-500",
  restored: "border-emerald-500",
  auto_published: "border-emerald-400",
  approved: "border-sky-500",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="text-stone-400">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-stone-800">{children}</dd>
    </div>
  );
}

/**
 * «Объявление» о действии над книгой: название, автор, действие, кто выполнил, причина,
 * даты, срок ограничения и текущий статус книги.
 */
export default function ModerationCard({
  entry,
  unread,
  showLink = true,
  currentState,
}: {
  entry: ModerationEntry;
  unread?: boolean;
  showLink?: boolean;
  /** актуальный статус книги (если известен); иначе — статус на момент действия */
  currentState?: { state: ModerationEntry["stateAfter"]; until?: string | null };
}) {
  const state = currentState?.state ?? entry.stateAfter;
  const until = currentState ? currentState.until : entry.until;
  const hideLike = entry.action === "hidden";

  return (
    <article
      className={`rounded-2xl border-l-4 bg-white p-4 shadow-sm ring-1 ring-stone-200 ${
        ACCENT[entry.action] ?? "border-stone-300"
      } ${unread ? "bg-indigo-50/40" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold text-stone-900">
          {actionHeadline(entry)}
          {unread && (
            <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-white">
              новое
            </span>
          )}
        </h3>
        <span
          className={`inline-flex h-fit w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[state]}`}
        >
          {stateLabel(state, until)}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5">
        <Row label="Название">
          {showLink ? (
            <Link href={`/book/${entry.bookId}/info`} className="text-indigo-700 hover:underline">
              «{entry.bookTitle}»
            </Link>
          ) : (
            <>«{entry.bookTitle}»</>
          )}
        </Row>
        <Row label="Автор">{entry.authorName}</Row>
        <Row label="Действие">{actionName(entry)}</Row>
        <Row label="Выполнил">{actorLabel(entry)}</Row>
        {entry.reason && <Row label="Причина">{entry.reason}</Row>}
        <Row label={hideLike ? "Дата скрытия" : "Дата и время"}>
          {hideLike ? fmtDate(entry.createdAt) : fmtDateTime(entry.createdAt)}
        </Row>
        {hideLike && entry.until && <Row label="Скрыта до">{fmtDate(entry.until)}</Row>}
        <Row label="Статус">{stateLabel(state, until)}</Row>
      </dl>
      {hideLike && <p className="mt-2 text-xs text-stone-400">Время действия: {fmtDateTime(entry.createdAt)}</p>}
    </article>
  );
}
