"use client";

import { useState } from "react";
import { FiFlag } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import ReportModal from "./ReportModal";

export default function ReportButton({ bookId }: { bookId: string | number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
      >
        <FiFlag /> Пожаловаться
      </button>
      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        targetType="book"
        targetId={bookId}
        title="Жалоба на объявление"
      />
    </>
  );
}
