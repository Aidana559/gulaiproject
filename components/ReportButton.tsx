"use client";

import { useState } from "react";
import { FiFlag } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import ReportModal from "./ReportModal";
import type { ReportTargetType } from "@/lib/types";

type Props = {
  /** Старый способ: жалоба на книгу по id */
  bookId?: string | number;
  targetType?: ReportTargetType;
  targetId?: string | number;
  label?: string;
  title?: string;
  /** Маленькая серая кнопка (для списков) */
  compact?: boolean;
};

/** Кнопка «Пожаловаться» + окно жалобы. Не показывается гостям и на собственные объекты. */
export default function ReportButton({
  bookId,
  targetType = "book",
  targetId,
  label = "Пожаловаться",
  title,
  compact,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const id = targetId ?? bookId;
  if (!user || id == null || id === "") return null;
  // жалоба на самого себя невозможна
  if (targetType === "user" && (String(id) === String(user.id) || String(id) === user.name)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 text-xs text-stone-500 hover:text-rose-600"
            : "inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
        }
      >
        <FiFlag /> {label}
      </button>
      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetId={id}
        title={title}
      />
    </>
  );
}
