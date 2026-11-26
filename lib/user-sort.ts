// Чистая логика сортировки / фильтрации / поиска пользователей для панелей
// администратора и модератора. Ничего не пишет в данные: все функции
// возвращают НОВЫЙ массив, исходный список (и JSON на сервере) не меняется.

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
export type MuteTermFilter = "all" | "temporary" | "permanent";
export type UserFilters = {
  role: RoleFilter;
  status: StatusFilter;
  /** Срок mute: только для пользователей в mute (есть mutedUntil — временный, нет — бессрочный). */
  muteTerm: MuteTermFilter;
  /** Дата регистрации «с» / «по» включительно, формат YYYY-MM-DD (локальные сутки). */
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_SORT: SortState = { field: null, dir: "asc" };
export const DEFAULT_FILTERS: UserFilters = {
  role: "all",
  status: "all",
  muteTerm: "all",
  dateFrom: "",
  dateTo: "",
};

export const MUTE_TERM_FILTERS: { key: MuteTermFilter; label: string }[] = [
  { key: "all", label: "Любой" },
  { key: "temporary", label: "Временный" },
  { key: "permanent", label: "Бессрочный" },
];

/** Сколько отдельных фильтров сейчас включено (поиск не считается). */
export function countActiveFilters(f: UserFilters): number {
  return (
    (f.role !== "all" ? 1 : 0) +
    (f.status !== "all" ? 1 : 0) +
    (f.muteTerm !== "all" ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0)
  );
}

/** YYYY-MM-DD в локальном часовом поясе. */
export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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

/** Описание полей сортировки: подписи и осмысленные названия направлений. */
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
  /** Как в конкретной таблице определяется «пользователь в mute». */
  isMuted: (u: SortableUser) => boolean;
  /** Учитывать ли blocked в статусе (в панели модератора блокировка не показывается). */
  showBlocked: boolean;
};

export function getUserStatus(u: SortableUser, ctx: UserListContext): UserStatus {
  if (ctx.showBlocked && u.blocked) return "blocked";
  if (ctx.isMuted(u)) return "muted";
  return "active";
}

/* ---------- нормализация ---------- */

export const normalize = (v: unknown) =>
  String(v ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

const ROLE_RANK: Record<UserRole, number> = { admin: 0, moderator: 1, user: 2 };
const STATUS_RANK: Record<UserStatus, number> = { active: 0, muted: 1, blocked: 2 };

/* ---------- ключи сортировки (null = «пустое значение») ---------- */

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

/**
 * Сравнение по одному полю. Пустые значения ВСЕГДА в конце списка —
 * независимо от направления (чтобы при «Я → А» не всплывали пользователи без значения).
 */
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

/** Возвращает отсортированную КОПИЮ списка. При field === null порядок не меняется. */
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
    // одинаковые значения: детерминированный порядок по имени, затем email
    for (const f of TIE_BREAKERS) {
      if (f === field) continue;
      const r = compareByField(x.u, y.u, f, "asc", ctx);
      if (r !== 0) return r;
    }
    return x.i - y.i; // и в конце — исходный порядок (стабильность)
  });
  return withIndex.map((x) => x.u);
}

/* ---------- поиск и фильтры ---------- */

/** Поиск по имени, email и ID. Роль ищется отдельным фильтром. */
export function matchesSearch(u: SortableUser, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(u.name).includes(q) || normalize(u.email).includes(q) || normalize(u.id).includes(q);
}

function dayStart(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0).getTime() : null;
}
function dayEnd(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999).getTime() : null;
}

export function matchesFilters(u: SortableUser, f: UserFilters, ctx: UserListContext): boolean {
  if (f.role !== "all" && u.role !== f.role) return false;
  if (f.status !== "all" && getUserStatus(u, ctx) !== f.status) return false;

  if (f.muteTerm !== "all") {
    if (!ctx.isMuted(u)) return false;
    const temporary = !!u.mutedUntil;
    if (f.muteTerm === "temporary" ? !temporary : temporary) return false;
  }

  if (f.dateFrom || f.dateTo) {
    const t = timeKey(u.createdAt);
    if (t === null) return false; // даты нет — под диапазон не подходит
    let from = f.dateFrom ? dayStart(f.dateFrom) : null;
    let to = f.dateTo ? dayEnd(f.dateTo) : null;
    if (from !== null && to !== null && from > to) {
      // перепутаны границы — трактуем как диапазон между двумя датами
      const a = dayStart(f.dateTo)!;
      const b = dayEnd(f.dateFrom)!;
      from = a;
      to = b;
    }
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
  }
  return true;
}

/** Единый конвейер: поиск → фильтры → сортировка. Исходный массив не изменяется. */
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
