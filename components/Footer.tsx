import Link from "next/link";
import { FiBookOpen } from "react-icons/fi";

export default function Footer() {
  return (
    <footer className="mt-20 px-3 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-indigo-100">
      <div className="grid gap-8 px-6 py-12 sm:px-10 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 font-serif text-3xl font-semibold text-stone-900">
            <FiBookOpen /> Page2Page
          </p>
          <p className="mt-3 max-w-xs text-sm text-stone-500">
            Студенческий буккроссинг: обменивайтесь книгами, учебниками, методичками и мангой.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-900">Разделы</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-500">
          <li><Link className="hover:text-indigo-600" href="/catalog">Каталог</Link></li>
          <li><Link className="hover:text-indigo-600" href="/add">Добавить книгу</Link></li>
          <li><Link className="hover:text-indigo-600" href="/transactions">Транзакции</Link></li>
          <li><Link className="hover:text-indigo-600" href="/profile">Личный кабинет</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-900">Проект</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-500">
            <li><Link className="hover:text-indigo-600" href="/about">О проекте</Link></li>
            <li><Link className="hover:text-indigo-600" href="/login">Войти</Link></li>
            <li><Link className="hover:text-indigo-600" href="/register">Регистрация</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-indigo-200/70 py-4 text-center text-xs text-stone-500">
        © 2026 Page2Page. Студенческая платформа обмена литературой.
      </div>
      </div>
    </footer>
  );
}