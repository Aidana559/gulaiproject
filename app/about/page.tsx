import { LinkButton } from "@/components/Button";

export const metadata = { title: "О проекте — Page2Page" };

const roles = [
  { icon: "🛡️", title: "Администратор", text: "Полный контроль: пользователи, каталоги, жанры, модерация контента." },
  { icon: "🔎", title: "Модератор", text: "Проверка объявлений и отзывов, решение спорных ситуаций по бронированию." },
  { icon: "👤", title: "Пользователь", text: "Публикует книги, ищет литературу, бронирует и пишет отзывы." },
];

const features = [
  "Добавление, редактирование и удаление объявлений",
  "Загрузка обложек",
  "Поиск и фильтрация по жанрам и статусу",
  "Бронирование и отзывы",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-stone-900">О проекте Page2Page</h1>
      <p className="mt-4 max-w-3xl text-stone-600">
        Page2Page — платформа студенческого буккроссинга. Участники каталогизируют прочитанные книги,
        обмениваются ими внутри сообщества, оставляют отзывы и управляют статусами бронирования.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-stone-200">
            <span className="text-emerald-600">✔</span> {f}
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-bold text-stone-900">Роли</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {roles.map((r) => (
          <div key={r.title} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
            <p className="text-3xl">{r.icon}</p>
            <h3 className="mt-3 font-semibold text-stone-900">{r.title}</h3>
            <p className="mt-1 text-sm text-stone-500">{r.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12"><LinkButton href="/catalog" size="lg">Перейти в каталог</LinkButton></div>
    </div>
  );
}