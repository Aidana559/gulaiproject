"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

export default function BookActions({
  bookId,
  ownerId,
}: {
  bookId: string | number;
  ownerId: string | number;
}) {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const allowed =
    String(user.id) === String(ownerId) ||
    user.name === String(ownerId) ||
    user.role === "admin" ||
    user.role === "moderator";
  if (!allowed) return null;

  const isOwner = String(user.id) === String(ownerId) || user.name === String(ownerId);

  async function remove() {
    let reason = "";
    if (isOwner) {
      if (!confirm("Удалить объявление? Отзывы и жалобы тоже будут удалены.")) return;
    } else {
      // администрация удаляет с причиной: автор получит уведомление
      const r = prompt("Причина удаления (её увидит автор книги):");
      if (r == null) return;
      reason = r.trim();
      if (reason.length < 3) {
        alert("Укажите причину удаления (не короче 3 символов)");
        return;
      }
    }
    try {
      await api(`/api/books/${bookId}`, user!.id, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      router.push("/catalog");
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/book/${bookId}/info`}
        className="rounded-xl px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
      >
        Информация
      </Link>
      <Link
        href={`/book/${bookId}/edit`}
        className="rounded-xl px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
      >
        Изменить
      </Link>
      <button
        onClick={remove}
        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Удалить
      </button>
    </div>
  );
}