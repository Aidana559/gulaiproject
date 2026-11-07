export type Role = "admin" | "moderator" | "user";

export type User = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  blocked?: boolean;
  muted?: boolean;
  mutedUntil?: string | null;
  muteReason?: string;
  [k: string]: unknown;
};

export type Review = {
  id: string;
  targetType: "book" | "user";
  targetId: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
};

export type ReportStatus = "new" | "in_review" | "resolved" | "rejected";

export type ReportTargetType = "book" | "review" | "user";

export type Report = {
  id: string;
  bookId?: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  reporterId: string;
  reasonCode?: string;
  reason: string;
  comment?: string;
  status: ReportStatus | "open" | "closed";
  createdAt: string;
  updatedAt?: string;
  handledBy?: string;
};

export type Genre = { id: string; name: string; type: "genre" | "category" };