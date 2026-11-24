"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiEdit2, FiInfo, FiTrash2 } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { ICON_SIZE_SM } from "@/components/CategoryIcon";

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

  const btn =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition";

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/book/${bookId}/info`}
        className={`${btn} text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50`}
        title="Подробная информация"
        aria-label="Подробная информация о книге"
      >
        <FiInfo className={ICON_SIZE_SM} aria-hidden />
        Информация
      </Link>
      <Link
        href={`/book/${bookId}/edit`}
        className={`${btn} text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50`}
        title="Редактировать объявление"
        aria-label="Редактировать объявление"
      >
        <FiEdit2 className={ICON_SIZE_SM} aria-hidden />
        Изменить
      </Link>
      <button
        type="button"
        onClick={remove}
        className={`${btn} bg-red-600 text-white hover:bg-red-700`}
        title="Удалить объявление"
        aria-label="Удалить объявление"
      >
        <FiTrash2 className={ICON_SIZE_SM} aria-hidden />
        Удалить
      </button>
    </div>
  );
}
