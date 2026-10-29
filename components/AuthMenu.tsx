"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import { LinkButton } from "./Button";

export default function AuthMenu() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-10 w-44" />;

  if (!user) {
    return (
      <>
        <LinkButton href="/login" variant="ghost" size="sm">
          Войти
        </LinkButton>
        <LinkButton href="/register" size="sm">
          Регистрация
        </LinkButton>
      </>
    );
  }

  return (
    <Link
      href="/profile"
      aria-label="Мой профиль"
      title={user.name}
      className="rounded-full ring-2 ring-transparent transition hover:ring-indigo-300"
    >
      <Avatar name={user.name} src={user.avatar} />
    </Link>
  );
}