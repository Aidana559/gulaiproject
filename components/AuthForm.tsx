"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "login" | "register";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Қате орын алды");
        return;
      }
      router.push("/profile");
    } catch {
      setError("Сервермен байланыс жоқ");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isRegister ? "Регистрация" : "Вход"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">Page2Page — студентческий буккроссинг</p>
        </div>

        {isRegister && (
          <label className="block text-sm text-slate-700">
            Имя
            <input name="name" required minLength={2} autoComplete="name" className={input} />
          </label>
        )}

        <label className="block text-sm text-slate-700">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>

        <label className="block text-sm text-slate-700">
          Пароль
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className={input}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-teal-800 px-4 py-2 font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {loading ? "Подождите…" : isRegister ? "Регистрация" : "Вход"}
        </button>

        <p className="text-center text-sm text-slate-600">
          {isRegister ? "Уже есть аккаунт? " : "Нет аккаунта? "}
          <Link href={isRegister ? "/login" : "/register"} className="font-medium text-teal-800 underline">
            {isRegister ? "Вход" : "Регистрация"}
          </Link>
        </p>
      </form>
    </main>
  );
}