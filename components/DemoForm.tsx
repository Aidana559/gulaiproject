"use client";

import { useState, type ReactNode } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { Button } from "./Button";

/** Форма-заглушка: пока нет бэкенда, показывает сообщение об успехе */
export default function DemoForm({
  children,
  submitLabel,
  successMessage,
}: {
  children: ReactNode;
  submitLabel: string;
  successMessage: string;
}) {
  const [done, setDone] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="space-y-5"
    >
      {children}
      <Button type="submit" size="lg" full>
        {submitLabel}
      </Button>
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          <FiCheckCircle className="shrink-0" /> {successMessage}
        </p>
      )}
    </form>
  );
}