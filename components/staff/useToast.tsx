"use client";

import { useEffect, useState } from "react";

/** Короткое уведомление внизу экрана (исчезает само). */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(t);
  }, [message]);

  const toastNode = message ? (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg"
    >
      {message}
    </div>
  ) : null;

  return { toast: setMessage, toastNode };
}
