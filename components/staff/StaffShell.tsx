"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBook,
  FiGrid,
  FiHome,
  FiInbox,
  FiLogOut,
  FiShield,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/components/AuthProvider";

export type StaffRole = "admin" | "moderator";

type MenuItem = { slug: string; label: string; Icon: IconType };

const MENUS: Record<StaffRole, { title: string; base: string; items: MenuItem[] }> = {
  admin: {
    title: "Панель администратора",
    base: "/admin",
    items: [
      { slug: "", label: "Обзор", Icon: FiHome },
      { slug: "reports", label: "Жалобы", Icon: FiAlertTriangle },
      { slug: "users", label: "Пользователи", Icon: FiUsers },
      { slug: "books", label: "Объявления", Icon: FiBook },
      { slug: "categories", label: "Категории", Icon: FiGrid },
      { slug: "genres", label: "Жанры", Icon: FiTag },
    ],
  },
  moderator: {
    title: "Панель модератора",
    base: "/moderation",
    items: [
      { slug: "queue", label: "Очередь на проверку", Icon: FiInbox },
      { slug: "reports", label: "Жалобы", Icon: FiAlertTriangle },
      { slug: "users", label: "Пользователи (mute)", Icon: FiUsers },
      { slug: "books", label: "Объявления", Icon: FiBook },
    ],
  },
};

export default function StaffShell({
  role,
  children,
}: {
  role: StaffRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const menu = MENUS[role];

  return (
    <div className={`staff staff--${role}`}>
      <aside className="staff-aside">
        <div className="staff-brand">
          <div className="staff-brand-main">
            <span className="staff-logo">
              <FiShield />
            </span>
            <div>
              <p className="staff-brand-name">Page2Page</p>
              <p className="staff-brand-title">{menu.title}</p>
            </div>
          </div>
          <Link href="/" className="staff-back-mobile">
            <FiArrowLeft /> На сайт
          </Link>
        </div>

        <nav aria-label={menu.title} className="staff-nav">
          {menu.items.map(({ slug, label, Icon }) => {
            const href = slug ? `${menu.base}/${slug}` : menu.base;
            // «Обзор» активен только на самой странице, остальные — и на вложенных
            const active = slug
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname === href;
            return (
              <Link
                key={slug || "home"}
                href={href}
                aria-current={active ? "page" : undefined}
                className="staff-link"
              >
                <Icon /> {label}
              </Link>
            );
          })}
        </nav>

        <div className="staff-footer">
          {user && (
            <div className="staff-user">
              <Avatar name={user.name} src={user.avatar} />
              <div style={{ minWidth: 0 }}>
                <p className="staff-user-name">{user.name}</p>
                <p className="staff-user-role">
                  {role === "admin" ? "Администратор" : "Модератор"}
                </p>
              </div>
            </div>
          )}
          <Link href="/" className="staff-link">
            <FiArrowLeft /> Вернуться на сайт
          </Link>
          <button type="button" onClick={logout} className="staff-link">
            <FiLogOut /> Выйти
          </button>
        </div>
      </aside>

      <main className="staff-main">
        <div className="staff-container">{children}</div>
      </main>
    </div>
  );
}