import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold text-indigo-700">
            <span>📚</span> Page2Page
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
      <div className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">
        © 2026 Page2Page. Студенческая платформа обмена литературой.
      </div>
    </footer>
  );
}