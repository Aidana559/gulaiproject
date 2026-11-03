"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

export default function ReportButton({ bookId }: { bookId: string | number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  if (!user) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/reports", user!.id, {
        method: "POST",
        body: JSON.stringify({ bookId: String(bookId), reason }),
      });
      setMsg("Жалоба отправлена модераторам");
      setReason("");
      setOpen(false);
    } catch (err: any) {
      setMsg(err.message);
    }
  }

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="text-sm text-red-600 underline">
        Пожаловаться
      </button>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      {open && (
        <form onSubmit={send} className="mt-2 space-y-2 rounded border p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required minLength={5} maxLength={500}
            placeholder="Причина жалобы (спам, запрещённый контент, оскорбления…)"
            className="w-full rounded border p-2"
            rows={3}
          />
          <button className="rounded bg-red-600 px-3 py-1 text-white">Отправить</button>
        </form>
      )}
    </div>
  );
}