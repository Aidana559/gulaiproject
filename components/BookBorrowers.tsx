import { FaStar } from "react-icons/fa";
import { getBookBorrowers, type Borrower, type Reliability } from "@/lib/bookings";
import { readJson } from "@/lib/db";
import { formatDate, txLabels, txStyles } from "@/data/transactions";
import type { Review } from "@/lib/types";
import BorrowerReview from "./BorrowerReview";
import ReportButton from "./ReportButton";

function reliabilityStyle(r: Reliability) {
  if (r.percent == null) return "bg-stone-100 text-stone-600 ring-stone-500/20";
  if (r.percent >= 80) return "bg-emerald-100 text-emerald-700 ring-emerald-600/20";
  if (r.percent >= 50) return "bg-amber-100 text-amber-700 ring-amber-600/20";
  return "bg-rose-100 text-rose-700 ring-rose-600/20";
}

function reliabilityText(r: Reliability) {
  if (r.percent == null) return "Истории возвратов пока нет";
  return `Возвращает вовремя: ${r.percent}% (${r.onTime} из ${r.total})`;
}

/** Список тех, кто брал книгу, с надёжностью каждого читателя. Скроллится внутри родителя фиксированной высоты. */
export default async function BookBorrowers({
  bookId,
  ownerKey,
}: {
  bookId: number;
  ownerKey: string;
}) {
  const borrowers = await getBookBorrowers(bookId);
  const reviews = await readJson<Review[]>("reviews.json", []);

  const ratingOf = (b: Borrower) => {
    const key = b.userId ?? b.name;
    const list = reviews.filter((r) => r.targetType === "user" && r.targetId === key);
    const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
    return { avg, count: list.length };
  };

  if (borrowers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500">
        Эту книгу пока никто не брал.
      </div>
    );
  }

  return (
    <ul className="h-full divide-y divide-stone-100 overflow-y-auto overscroll-contain">
      {borrowers.map((b) => {
        const rating = ratingOf(b);
        return (
          <li key={b.key} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                  {(b.name || "?")[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">{b.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                    <span>
                      {formatDate(b.startDate)} – {formatDate(b.returnedAt ?? b.dueDate)}
                    </span>
                    {rating.count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FaStar className="text-amber-400" />
                        {rating.avg.toFixed(1)} ({rating.count})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${txStyles[b.status]}`}
              >
                {txLabels[b.status]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-[3.25rem]">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${reliabilityStyle(b.reliability)}`}
                title="Доля книг, возвращённых в срок"
              >
                {reliabilityText(b.reliability)}
              </span>
              <BorrowerReview targetId={b.userId ?? b.name} name={b.name} ownerKey={ownerKey} />
              {b.userId && (
                <ReportButton
                  targetType="user"
                  targetId={b.userId}
                  label="Пожаловаться"
                  title="Жалоба на пользователя"
                  compact
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
