"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  SORT_FIELDS,
  buildUserView,
  type RoleFilter,
  type SortDir,
  type SortState,
  type SortableUser,
  type StatusFilter,
  type UserListContext,
  type UserSortField,
} from "@/lib/user-sort";


export function useUserListView<T extends SortableUser>(users: T[], ctx: UserListContext) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>(DEFAULT_FILTERS.role);
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_FILTERS.status);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const { isMuted, showBlocked } = ctx;
  const rows = useMemo(
    () =>
      buildUserView(users, { query, filters: { role, status }, sort }, { isMuted, showBlocked }),
    [users, query, role, status, sort, isMuted, showBlocked],
  );

  
  const setSortField = useCallback((field: UserSortField | null) => {
    setSort(field ? { field, dir: SORT_FIELDS[field].defaultDir } : DEFAULT_SORT);
  }, []);

  const setSortDir = useCallback((dir: SortDir) => {
    setSort((s) => (s.field ? { ...s, dir } : s));
  }, []);

  
  const toggleSort = useCallback((field: UserSortField) => {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { field, dir: SORT_FIELDS[field].defaultDir },
    );
  }, []);

  const resetSort = useCallback(() => setSort(DEFAULT_SORT), []);
  const resetFilters = useCallback(() => {
    setRole(DEFAULT_FILTERS.role);
    setStatus(DEFAULT_FILTERS.status);
  }, []);
  const resetAll = useCallback(() => {
    setQuery("");
    setRole(DEFAULT_FILTERS.role);
    setStatus(DEFAULT_FILTERS.status);
    setSort(DEFAULT_SORT);
  }, []);

  const filtersActive = role !== "all" || status !== "all";

  return {
    rows,
    query,
    setQuery,
    role,
    setRole,
    status,
    setStatus,
    sort,
    setSortField,
    setSortDir,
    toggleSort,
    resetSort,
    resetFilters,
    resetAll,
    filtersActive,
    sortActive: sort.field !== null,
    anyActive: query.trim() !== "" || filtersActive || sort.field !== null,
    hasFilterOrSearch: query.trim() !== "" || filtersActive,
  };
}

export type UserListView = ReturnType<typeof useUserListView>;
