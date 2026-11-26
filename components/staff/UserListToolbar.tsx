"use client";

import { FiArrowDown, FiArrowUp, FiSearch, FiX } from "react-icons/fi";
import type { UserListView } from "./useUserListView";
import {
  ROLE_FILTERS,
  SORT_FIELDS,
  type RoleFilter,
  type StatusFilter,
  type UserSortField,
} from "@/lib/user-sort";

const selectClass =
  "h-9 cursor-pointer rounded-full bg-stone-100/70 pl-3 pr-2 text-sm text-stone-800 outline-none transition hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-indigo-600";

const linkBtn =
  "text-sm text-stone-500 underline-offset-4 transition hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:text-indigo-700 focus-visible:underline";

/**
 * Поиск, фильтры и сортировка — три независимых механизма в одной компактной строке.
 * Сброс фильтров не трогает сортировку и наоборот.
 */
export default function UserListToolbar({
  view,
  idPrefix,
  searchPlaceholder,
  statusOptions,
  sortFields,
  total,
  loaded,
}: {
  view: UserListView;
  idPrefix: string;
  searchPlaceholder: string;
  statusOptions: { key: StatusFilter; label: string }[];
  sortFields: UserSortField[];
  total: number;
  loaded: boolean;
}) {
  const cfg = view.sort.field ? SORT_FIELDS[view.sort.field] : null;
  const DirIcon = view.sort.dir === "asc" ? FiArrowUp : FiArrowDown;
  const dirLabel = cfg ? (view.sort.dir === "asc" ? cfg.asc : cfg.desc) : "";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Поиск */}
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor={`${idPrefix}-search`} className="sr-only">
            Поиск пользователей
          </label>
          <FiSearch
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          />
          <input
            id={`${idPrefix}-search`}
            type="search"
            value={view.query}
            onChange={(e) => view.setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="h-9 w-full rounded-full bg-stone-100/70 pl-10 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-indigo-600"
          />
        </div>

        {/* Фильтры */}
        <div className="flex items-center gap-2" role="group" aria-label="Фильтры">
          <label htmlFor={`${idPrefix}-role`} className="sr-only">
            Роль
          </label>
          <select
            id={`${idPrefix}-role`}
            value={view.role}
            onChange={(e) => view.setRole(e.target.value as RoleFilter)}
            className={`${selectClass} ${view.role !== "all" ? "font-medium text-indigo-800" : ""}`}
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.key === "all" ? "Роль: все" : r.label}
              </option>
            ))}
          </select>

          <label htmlFor={`${idPrefix}-status`} className="sr-only">
            Статус
          </label>
          <select
            id={`${idPrefix}-status`}
            value={view.status}
            onChange={(e) => view.setStatus(e.target.value as StatusFilter)}
            className={`${selectClass} ${view.status !== "all" ? "font-medium text-indigo-800" : ""}`}
          >
            {statusOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.key === "all" ? "Статус: все" : s.label}
              </option>
            ))}
          </select>
        </div>

        <span aria-hidden className="hidden h-5 w-px bg-stone-200 sm:block" />

        {/* Сортировка */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Сортировка">
          <label htmlFor={`${idPrefix}-sort`} className="sr-only">
            Сортировать по
          </label>
          <select
            id={`${idPrefix}-sort`}
            value={view.sort.field ?? ""}
            onChange={(e) => view.setSortField((e.target.value || null) as UserSortField | null)}
            className={`${selectClass} ${view.sort.field ? "font-medium text-indigo-800" : ""}`}
          >
            <option value="">Сортировка: нет</option>
            {sortFields.map((f) => (
              <option key={f} value={f}>
                {SORT_FIELDS[f].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!view.sort.field}
            onClick={() => view.setSortDir(view.sort.dir === "asc" ? "desc" : "asc")}
            title={cfg ? `${dirLabel} — нажмите, чтобы изменить` : "Сначала выберите поле"}
            aria-label={cfg ? `Направление сортировки: ${dirLabel}` : "Направление сортировки"}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:pointer-events-none disabled:opacity-30"
          >
            <DirIcon aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Статус выдачи и сбросы */}
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-stone-500" role="status" aria-live="polite">
        {loaded && (
          <span>
            Найдено <span className="font-medium text-stone-700">{view.rows.length}</span>
            {view.rows.length !== total && <> из {total}</>}
            {cfg && (
              <span className="text-stone-400">
                {" "}· {cfg.label.toLowerCase()}, {dirLabel.toLowerCase()}
              </span>
            )}
          </span>
        )}
        {view.filtersActive && (
          <button type="button" onClick={view.resetFilters} className={`${linkBtn} inline-flex items-center gap-1`}>
            <FiX aria-hidden className="h-3.5 w-3.5" /> Сбросить фильтры
          </button>
        )}
        {view.sortActive && (
          <button type="button" onClick={view.resetSort} className={`${linkBtn} inline-flex items-center gap-1`}>
            <FiX aria-hidden className="h-3.5 w-3.5" /> Сбросить сортировку
          </button>
        )}
      </div>
    </div>
  );
}
