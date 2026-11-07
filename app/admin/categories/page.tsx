import PageTitle from "@/components/staff/PageTitle";
import { categoryLabels, type Category } from "@/data/books";

export default function AdminCategoriesPage() {
  return (
    <>
      <PageTitle title="Категории" hint="Типы изданий, которые есть в каталоге." />
      <ul className="mt-6 space-y-2 rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        {(Object.keys(categoryLabels) as Category[]).map((c) => (
          <li
            key={c}
            className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2.5 text-sm"
          >
            <span className="font-medium text-stone-800">{categoryLabels[c]}</span>
            <span className="text-xs text-stone-400">{c}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
