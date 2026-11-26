
export type UserRole = "admin" | "moderator" | "user";
export type UserStatus = "active" | "muted" | "blocked";

export type SortableUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  blocked?: boolean;
  muted?: boolean;
  mutedUntil?: string | null;
  createdAt?: string | null;
};

export type UserSortField = "name" | "email" | "createdAt" | "role" | "status" | "mutedUntil";
export type SortDir = "asc" | "desc";
export type SortState = { field: UserSortField | null; dir: SortDir };

export type RoleFilter = "all" | UserRole;
export type StatusFilter = "all" | UserStatus;
export type UserFilters = { role: RoleFilter; status: StatusFilter };

export const DEFAULT_SORT: SortState = { field: null, dir: "asc" };
export const DEFAULT_FILTERS: UserFilters = { role: "all", status: "all" };

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  user: "Пользователь",
};

export const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "Все роли" },
  { key: "admin", label: "Администраторы" },
  { key: "moderator", label: "Модераторы" },
  { key: "user", label: "Пользователи" },
];


export const SORT_FIELDS: Record<
  UserSortField,
  { label: string; asc: string; desc: string; defaultDir: SortDir }
> = {
  name: { label: "Имя", asc: "От А до Я", desc: "От Я до А", defaultDir: "asc" },
  email: { label: "Email", asc: "От А до Я", desc: "От Я до А", defaultDir: "asc" },
  createdAt: {
    label: "Дата регистрации",
    asc: "Сначала старые",
    desc: "Сначала новые",
    defaultDir: "desc",
  },
  role: {
    label: "Роль",
    asc: "Сначала администраторы",
    desc: "Сначала пользователи",
    defaultDir: "asc",
  },
  status: {
    label: "Статус",
    asc: "Сначала активные",
    desc: "Сначала с ограничениями",
    defaultDir: "asc",
  },
  mutedUntil: {
    label: "Срок mute",
    asc: "Сначала истекающие",
    desc: "Сначала самые долгие",
    defaultDir: "asc",
  },
};

export type UserListContext = {
  
  isMuted: (u: SortableUser) => boolean;
  
  showBlocked: boolean;
};

export function getUserStatus(u: SortableUser, ctx: UserListContext): UserStatus {
  if (ctx.showBlocked && u.blocked) return "blocked";
  if (ctx.isMuted(u)) return "muted";
  return "active";
}


export const normalize = (v: unknown) =>
  String(v ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

const ROLE_RANK: Record<UserRole, number> = { admin: 0, moderator: 1, user: 2 };
const STATUS_RANK: Record<UserStatus, number> = { active: 0, muted: 1, blocked: 2 };



function textKey(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function timeKey(v: unknown): number | null {
  if (!v) return null;
  const n = new Date(String(v)).getTime();
  return Number.isFinite(n) ? n : null;
}

function sortKey(
  u: SortableUser,
  field: UserSortField,
  ctx: UserListContext,
): string | number | null {
  switch (field) {
    case "name":
      return textKey(u.name);
    case "email":
      return textKey(u.email);
    case "createdAt":
      return timeKey(u.createdAt);
    case "role":
      return u.role && u.role in ROLE_RANK ? ROLE_RANK[u.role as UserRole] : null;
    case "status":
      return STATUS_RANK[getUserStatus(u, ctx)];
    case "mutedUntil":
      if (!ctx.isMuted(u)) return null; // нет mute — «пусто»
      return u.mutedUntil ? (timeKey(u.mutedUntil) ?? null) : Number.POSITIVE_INFINITY; // бессрочный
  }
}

function compareKeys(a: string | number | null, b: string | number | null): number {
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
  return 0;
}


function compareByField(
  a: SortableUser,
  b: SortableUser,
  field: UserSortField,
  dir: SortDir,
  ctx: UserListContext,
): number {
  const ka = sortKey(a, field, ctx);
  const kb = sortKey(b, field, ctx);
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  const r = compareKeys(ka, kb);
  return dir === "asc" ? r : -r;
}

const TIE_BREAKERS: UserSortField[] = ["name", "email"];


export function sortUsers<T extends SortableUser>(
  users: readonly T[],
  sort: SortState,
  ctx: UserListContext,
): T[] {
  if (!sort.field) return [...users];
  const field = sort.field;
  const withIndex = users.map((u, i) => ({ u, i }));
  withIndex.sort((x, y) => {
    const primary = compareByField(x.u, y.u, field, sort.dir, ctx);
    if (primary !== 0) return primary;
    
    for (const f of TIE_BREAKERS) {
      if (f === field) continue;
      const r = compareByField(x.u, y.u, f, "asc", ctx);
      if (r !== 0) return r;
    }
    return x.i - y.i; 
  });
  return withIndex.map((x) => x.u);
}



export function matchesSearch(u: SortableUser, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const roleLabel = u.role && u.role in ROLE_LABEL ? ROLE_LABEL[u.role as UserRole] : "";
  return (
    normalize(u.name).includes(q) ||
    normalize(u.email).includes(q) ||
    normalize(u.role).includes(q) ||
    normalize(roleLabel).includes(q)
  );
}

export function matchesFilters(u: SortableUser, f: UserFilters, ctx: UserListContext): boolean {
  if (f.role !== "all" && u.role !== f.role) return false;
  if (f.status !== "all" && getUserStatus(u, ctx) !== f.status) return false;
  return true;
}


export function buildUserView<T extends SortableUser>(
  users: readonly T[],
  opts: { query: string; filters: UserFilters; sort: SortState },
  ctx: UserListContext,
): T[] {
  const filtered = users.filter(
    (u) => matchesSearch(u, opts.query) && matchesFilters(u, opts.filters, ctx),
  );
  return sortUsers(filtered, opts.sort, ctx);
}
