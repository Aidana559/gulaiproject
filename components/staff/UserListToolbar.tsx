"use client";

import { FiArrowDown, FiArrowUp, FiSearch, FiX } from "react-icons/fi";
import type { UserListView } from "./useUserListView";
import {
  MUTE_TERM_FILTERS,
  ROLE_FILTERS,
  SORT_FIELDS,
  toDateInput,
  type MuteTermFilter,
  type RoleFilter,
  type StatusFilter,
  type UserSortField,
} from "@/lib/user-sort";

const fieldBase =
  "h-9 w-full rounded-full bg-stone-100/70 text-sm text-stone-800 outline-none transition hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-indigo-600";
const selectClass = `${fieldBase} cursor-pointer pl-3 pr-2`;
const dateClass = `${fieldBase} px-3`;

const linkBtn =
  "inline-flex items-center gap-1 text-sm text-stone-500 underline-offset-4 transition hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:text-indigo-700 focus-visible:underline disabled:pointer-events-none disabled:opacity-40";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block px-1 text-xs text-stone-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const PRESETS = [
  { key: "any", label: "Любая дата" },
  { key: "7", label: "За 7 дней" },
  { key: "30", label: "За 30 дней" },
  { key: "custom", label: "Свой период…" },
] as const;

/**
 * Три независимых блока: поиск, фильтры и сортировка.
 * «Сбросить фильтры» очищает поиск и фильтры, сортировку не трогает; «Сбросить сортировку» — наоборот.
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
  const id = (s: string) => `${idPrefix}-${s}`;

  // Пресет периода определяется по самим датам, отдельного состояния нет.
  const hasDates = !!(view.dateFrom || view.dateTo);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toDateInput(d);
  };
  const preset = !hasDates
    ? "any"
    : !view.dateTo && view.dateFrom === daysAgo(6)
      ? "7"
      : !view.dateTo && view.dateFrom === daysAgo(29)
        ? "30"
        : "custom";

  return (
    <div className="mt-6 space-y-4">
      {/* Поиск */}
      <div className="relative">
        <label htmlFor={id("search")} className="sr-only">
          Поиск пользователей
        </label>
        <FiSearch aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          id={id("search")}
          type="search"
          value={view.query}
          onChange={(e) => view.setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="h-10 w-full rounded-full bg-stone-100/70 pl-10 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-indigo-600"
        />
      </div>

      {/* Блок фильтров */}
      <section aria-labelledby={id("filters")} className="border-t border-stone-200 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id={id("filters")} className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Фильтры
            {view.activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold normal-case text-indigo-800">
                {view.activeFilterCount}
              </span>
            )}
          </h2>
          <button type="button" onClick={view.resetFilters} disabled={!view.filtersActive} className={linkBtn}>
            <FiX aria-hidden className="h-3.5 w-3.5" /> Сбросить фильтры
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Роль" htmlFor={id("role")}>
            <select
              id={id("role")}
              value={view.role}
              onChange={(e) => view.setRole(e.target.value as RoleFilter)}
              className={`${selectClass} ${view.role !== "all" ? "font-medium text-indigo-800" : ""}`}
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Статус аккаунта" htmlFor={id("status")}>
            <select
              id={id("status")}
              value={view.status}
              onChange={(e) => view.setStatus(e.target.value as StatusFilter)}
              className={`${selectClass} ${view.status !== "all" ? "font-medium text-indigo-800" : ""}`}
            >
              {statusOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Срок mute" htmlFor={id("mute-term")}>
            <select
              id={id("mute-term")}
              value={view.muteTerm}
              onChange={(e) => view.setMuteTerm(e.target.value as MuteTermFilter)}
              className={`${selectClass} ${view.muteTerm !== "all" ? "font-medium text-indigo-800" : ""}`}
            >
              {MUTE_TERM_FILTERS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Дата регистрации" htmlFor={id("date-preset")}>
            <select
              id={id("date-preset")}
              value={preset}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "any") {
                  view.setDateFrom("");
                  view.setDateTo("");
                } else if (v === "custom") {
                  // открываем поля периода: подставляем сегодняшнюю дату как начало
                  if (!hasDates) view.setDateLastDays(1);
                } else {
                  view.setDateLastDays(Number(v));
                }
              }}
              className={`${selectClass} ${hasDates ? "font-medium text-indigo-800" : ""}`}
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {hasDates && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-[calc(50%-0.375rem)]">
            <Field label="Зарегистрирован с" htmlFor={id("date-from")}>
              <input
                id={id("date-from")}
                type="date"
                value={view.dateFrom}
                max={view.dateTo || undefined}
                onChange={(e) => view.setDateFrom(e.target.value)}
                className={dateClass}
              />
            </Field>
            <Field label="по" htmlFor={id("date-to")}>
              <input
                id={id("date-to")}
                type="date"
                value={view.dateTo}
                min={view.dateFrom || undefined}
                onChange={(e) => view.setDateTo(e.target.value)}
                className={dateClass}
              />
            </Field>
          </div>
        )}
      </section>

      {/* Блок сортировки */}
      <section aria-labelledby={id("sorting")} className="border-t border-stone-200 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id={id("sorting")} className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Сортировка
          </h2>
          <div className="flex items-center gap-1.5">
            <label htmlFor={id("sort")} className="sr-only">
              Сортировать по
            </label>
            <select
              id={id("sort")}
              value={view.sort.field ?? ""}
              onChange={(e) => view.setSortField((e.target.value || null) as UserSortField | null)}
              className={`${selectClass} !w-auto min-w-[10rem] ${view.sort.field ? "font-medium text-indigo-800" : ""}`}
            >
              <option value="">Без сортировки</option>
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
          {cfg && <span className="text-sm text-stone-400">{dirLabel}</span>}
          <button type="button" onClick={view.resetSort} disabled={!view.sortActive} className={`${linkBtn} sm:ml-auto`}>
            <FiX aria-hidden className="h-3.5 w-3.5" /> Сбросить сортировку
          </button>
        </div>
      </section>

      {/* Количество найденных */}
      <p className="border-t border-stone-200 px-1 pt-3 text-sm text-stone-500" role="status" aria-live="polite">
        {loaded && (
          <>
            Найдено пользователей: <span className="font-semibold text-stone-800">{view.rows.length}</span>
            {view.rows.length !== total && <> из {total}</>}
          </>
        )}
      </p>
    </div>
  );
}
