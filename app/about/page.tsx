import { FiCheck, FiSearch, FiShield, FiUser } from "react-icons/fi";
import { LinkButton } from "@/components/Button";

export const metadata = { title: "О проекте — Page2Page" };

const roles = [
  {
    Icon: FiShield,
    title: "Администратор",
    text: "Управляет пользователями и ролями, видит все транзакции, может модерировать объявления и отзывы.",
  },
  {
    Icon: FiSearch,
    title: "Модератор",
    text: "Разбирает жалобы на книги и отзывы, скрывает и удаляет объявления, может выдать mute (запрет на новые объявления).",
  },
  {
    Icon: FiUser,
    title: "Пользователь",
    text: "Добавляет книги в каталог, бронирует чужие книги (свои бронировать нельзя), выдаёт свои книги и оценивает читателей, пишет отзывы и оставляет жалобы.",
  },
];

const features = [
  "Каталог книг, учебников, методичек и манги с поиском и фильтрами",
  "Добавление объявлений с обложкой, ISBN, состоянием и корпусом (на сервере)",
  "Бронирование: бронь, выдача, возврат; у каждой книги виден список взявших и надёжность читателей",
  "Транзакции: свои заявки и заявки на ваши книги (админ видит все)",
  "Отзывы и оценки 1–5, жалобы на объявления и отзывы",
  "Модерация: очередь объявлений, жалобы, mute пользователей",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-stone-900">О проекте Page2Page</h1>
      <p className="mt-4 max-w-3xl text-stone-600">
        Page2Page — студенческий буккроссинг. Можно выставлять прочитанные книги, бронировать чужие,
        отслеживать выдачу и возврат, оставлять отзывы. Объявления и брони хранятся на сервере, поэтому
        видны всем участникам, а не только в одном браузере.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-stone-200">
            <FiCheck className="mt-1 shrink-0 text-emerald-600" /> <span>{f}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-bold text-stone-900">Роли</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {roles.map((r) => (
          <div key={r.title} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
            <r.Icon className="text-3xl text-indigo-600" />
            <h3 className="mt-3 font-semibold text-stone-900">{r.title}</h3>
            <p className="mt-1 text-sm text-stone-500">{r.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm text-stone-500">
        Гостю доступны главная, каталог и эта страница. После входа появляются транзакции и добавление
        книг; модератору — раздел «Модерация», администратору — ещё и «Админка».
      </p>

      <div className="mt-8">
        <LinkButton href="/catalog" size="lg">
          Перейти в каталог
        </LinkButton>
      </div>
    </div>
  );
}
