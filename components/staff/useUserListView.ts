"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  SORT_FIELDS,
  buildUserView,
  countActiveFilters,
  toDateInput,
  type MuteTermFilter,
  type RoleFilter,
  type SortDir,
  type SortState,
  type SortableUser,
  type StatusFilter,
  type UserListContext,
  type UserSortField,
} from "@/lib/user-sort";

/**
 * Состояние «вида» списка пользователей: поиск, фильтры и сортировка —
 * три независимых состояния. Меняется только порядок/набор отображаемых строк
 * (useMemo над копией), исходный массив users и данные на сервере не затрагиваются.
 */
export function useUserListView<T extends SortableUser>(users: T[], ctx: UserListContext) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>(DEFAULT_FILTERS.role);
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_FILTERS.status);
  const [muteTerm, setMuteTerm] = useState<MuteTermFilter>(DEFAULT_FILTERS.muteTerm);
  const [dateFrom, setDateFrom] = useState(DEFAULT_FILTERS.dateFrom);
  const [dateTo, setDateTo] = useState(DEFAULT_FILTERS.dateTo);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const { isMuted, showBlocked } = ctx;
  const rows = useMemo(
    () =>
      buildUserView(
        users,
        { query, filters: { role, status, muteTerm, dateFrom, dateTo }, sort },
        { isMuted, showBlocked },
      ),
    [users, query, role, status, muteTerm, dateFrom, dateTo, sort, isMuted, showBlocked],
  );

  /** Выбор поля в блоке сортировки: направление по умолчанию для поля. null — сброс. */
  const setSortField = useCallback((field: UserSortField | null) => {
    setSort(field ? { field, dir: SORT_FIELDS[field].defaultDir } : DEFAULT_SORT);
  }, []);

  const setSortDir = useCallback((dir: SortDir) => {
    setSort((s) => (s.field ? { ...s, dir } : s));
  }, []);

  /** Клик по заголовку столбца: новое поле — направление по умолчанию, то же поле — переключение. */
  const toggleSort = useCallback((field: UserSortField) => {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { field, dir: SORT_FIELDS[field].defaultDir },
    );
  }, []);

  const resetSort = useCallback(() => setSort(DEFAULT_SORT), []);
  /** «Сбросить фильтры»: поиск и все фильтры. Сортировка не затрагивается. */
  const resetFilters = useCallback(() => {
    setQuery("");
    setRole(DEFAULT_FILTERS.role);
    setStatus(DEFAULT_FILTERS.status);
    setMuteTerm(DEFAULT_FILTERS.muteTerm);
    setDateFrom(DEFAULT_FILTERS.dateFrom);
    setDateTo(DEFAULT_FILTERS.dateTo);
  }, []);

  /** Быстрый выбор периода регистрации: «последние N дней» (включая сегодня). */
  const setDateLastDays = useCallback((days: number) => {
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setDateFrom(toDateInput(from));
    setDateTo("");
  }, []);
  const resetAll = useCallback(() => {
    resetFilters();
    setSort(DEFAULT_SORT);
  }, [resetFilters]);

  const activeFilterCount = countActiveFilters({ role, status, muteTerm, dateFrom, dateTo });
  // Фильтры в смысле кнопки «Сбросить»: поиск или хотя бы один фильтр.
  const filtersActive = activeFilterCount > 0 || query.trim() !== "";

  return {
    rows,
    query,
    setQuery,
    role,
    setRole,
    status,
    setStatus,
    muteTerm,
    setMuteTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    setDateLastDays,
    activeFilterCount,
    sort,
    setSortField,
    setSortDir,
    toggleSort,
    resetSort,
    resetFilters,
    resetAll,
    filtersActive,
    sortActive: sort.field !== null,
    anyActive: filtersActive || sort.field !== null,
    hasFilterOrSearch: filtersActive,
  };
}

export type UserListView = ReturnType<typeof useUserListView>;
