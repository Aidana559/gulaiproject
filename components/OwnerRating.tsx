"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { Stars } from "./Stars";

export default function OwnerRating({
  userId,
  label = "Рейтинг владельца",
}: {
  userId: string | number;
  label?: string;
}) {
  const { user } = useAuth();
  const [s, setS] = useState({ average: 0, count: 0 });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setS(await api(`/api/reviews?targetType=user&targetId=${encodeURIComponent(String(userId))}`));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  async function rate(v: number) {
    setMsg("");
    try {
      await api("/api/reviews", user!.id, {
        method: "POST",
        body: JSON.stringify({ targetType: "user", targetId: String(userId), rating: v, text: "" }),
      });
      setMsg("Оценка сохранена");
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const canRate =
    !!user && String(user.id) !== String(userId) && user.name !== String(userId);

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="text-stone-500">{label}:</span>
        <Stars value={s.average} className="text-base" />
        <span>{s.count ? `${s.average.toFixed(1)} (${s.count})` : "нет оценок"}</span>
      </div>
      {canRate && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-stone-400">Ваша оценка:</span>
          <Stars value={0} onChange={rate} className="text-base" />
          {msg && <span className="text-stone-500">{msg}</span>}
        </div>
      )}
    </div>
  );
}