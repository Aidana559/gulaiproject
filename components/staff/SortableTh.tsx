"use client";

import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import { SORT_FIELDS, type SortState, type UserSortField } from "@/lib/user-sort";

/** Нейтральная иконка «столбец можно сортировать». */
function NeutralIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6.5 8 3.5l3 3" />
      <path d="M5 9.5 8 12.5l3-3" />
    </svg>
  );
}

/** Иконка направления сортировки для поля (стрелка вверх/вниз или нейтральная). */
export function SortIcon({ sort, field }: { sort: SortState; field: UserSortField }) {
  if (sort.field !== field) return <NeutralIcon />;
  return sort.dir === "asc" ? (
    <FiArrowUp aria-hidden className="h-3.5 w-3.5" />
  ) : (
    <FiArrowDown aria-hidden className="h-3.5 w-3.5" />
  );
}

export default function SortableTh({
  field,
  label,
  sort,
  onToggle,
}: {
  field: UserSortField;
  label: string;
  sort: SortState;
  onToggle: (field: UserSortField) => void;
}) {
  const active = sort.field === field;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const cfg = SORT_FIELDS[field];
  const next = active ? (sort.dir === "asc" ? cfg.desc : cfg.asc) : cfg[cfg.defaultDir];
  return (
    <th className="px-3 py-2.5 font-medium" aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        title={`Сортировать: ${next.toLowerCase()}`}
        className={`-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
          active ? "text-indigo-700" : ""
        }`}
      >
        {label}
        <SortIcon sort={sort} field={field} />
      </button>
    </th>
  );
}
