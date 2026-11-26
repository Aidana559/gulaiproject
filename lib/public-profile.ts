import type { Category } from "@/data/books";
import type { LiveBookStatus } from "@/lib/book-live";
import { getBookLiveStatuses } from "@/lib/bookings";
import { getAllBooks, genresOf } from "@/lib/books-store";
import { readJson } from "@/lib/db";
import { bookState } from "@/lib/moderation-shared";
import { hasPublicProfile } from "@/lib/profile-access";
import type { Review } from "@/lib/types";
import { findUserById } from "@/lib/users-store";


export type PublicBook = {
  id: number | string;
  title: string;
  author: string;
  category: Category;
  genres: string[];
  coverUrl: string | null;
  gradient: string;
  status: LiveBookStatus;
};

export type PublicProfile = {
  user: { id: string; name: string; avatar: string | null; bio: string; createdAt: string };
  rating: { average: number; count: number };
  books: PublicBook[];
};


export async function getPublicProfile(id: string, staff = false): Promise<PublicProfile | null> {
  const target = await findUserById(id);
  if (!target || (!staff && !hasPublicProfile(target))) return null;
  const uid = String(target.id);

  
  
  
  const [all, live] = await Promise.all([getAllBooks(), getBookLiveStatuses()]);
  const books: PublicBook[] = all
    .filter((b) => b.ownerId != null && String(b.ownerId) === uid && bookState(b) === "published")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || Number(b.id) - Number(a.id))
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category,
      genres: genresOf(b),
      coverUrl: b.coverUrl ?? null,
      gradient: b.gradient,
      status: live[String(b.id)] ?? "available",
    }));

  const ratings = (await readJson<Review[]>("reviews.json", [])).filter(
    (r) => r.targetType === "user" && r.targetId === uid,
  );
  const count = ratings.length;
  const average = count ? ratings.reduce((s, r) => s + r.rating, 0) / count : 0;

  return { user: { id: uid, name: target.name, avatar: target.avatar ?? null, bio: target.bio ?? "", createdAt: target.createdAt }, rating: { average, count }, books };
}
