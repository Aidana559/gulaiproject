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


export type Report = {
  id: string;
  bookId?: string;
  targetType: "book" | "review";
  targetId: string;
  reporterId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: string;
};

export type Genre = { id: string; name: string; type: "genre" | "category" };