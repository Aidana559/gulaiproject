// Клиент-безопасный помощник: превращает категории Google Books (обычно на английском,
// вида "Fiction / Science Fiction / General") в жанры из нашего списка (data/books.ts).
import type { Category } from "@/data/books";

type Rule = { re: RegExp; genre: string };

// Порядок важен: более конкретные правила — выше.
const RULES: Rule[] = [
  { re: /dystopi/i, genre: "Антиутопия" },
  { re: /dark fantasy/i, genre: "Тёмное фэнтези" },
  { re: /fantasy/i, genre: "Фэнтези" },
  { re: /science fiction|sci-?fi|фантаст/i, genre: "Фантастика" },
  { re: /horror|ужас/i, genre: "Хоррор" },
  { re: /thriller|suspense|триллер/i, genre: "Триллер" },
  { re: /mystery|detective|crime|детектив/i, genre: "Детектив" },
  { re: /adventure|приключ/i, genre: "Приключения" },
  { re: /fairy tale|folk ?tale|сказ|ертегі/i, genre: "Сказка" },
  { re: /shoujo|shojo/i, genre: "Сёдзё" },
  { re: /shounen|shonen/i, genre: "Сёнэн" },
  { re: /seinen/i, genre: "Сэйнэн" },
  { re: /classic|классик|классика/i, genre: "Классика" },
  { re: /romance|love stor|роман|novel|махаббат/i, genre: "Роман" },
  { re: /self-help|personal development|self improvement|psycholog|саморазв/i, genre: "Саморазвитие" },
  { re: /histor|истори|тарих/i, genre: "История" },
  { re: /computer|programming|software|informatic|информатик/i, genre: "Информатика" },
  { re: /mathemat|математик/i, genre: "Математика" },
  { re: /physic|физик/i, genre: "Физика" },
  { re: /chemistr|химия/i, genre: "Химия" },
  { re: /biolog|биолог/i, genre: "Биология" },
  { re: /engineer|technolog|инженер/i, genre: "Инженерия" },
  { re: /econom|business|finance|экономик/i, genre: "Экономика" },
  { re: /^science$|natural science|наука/i, genre: "Наука" },
  // общие «художественные» категории — в самом конце
  { re: /^(juvenile )?fiction$|literary|literature|poetry|drama|stories|художествен|проза|əдебиет|әдебиет/i, genre: "Художественная литература" },
];

export const GOOGLE_GENRE_FALLBACK = "Художественная литература";

/** Категории Google ("A / B / C") → список жанров без повторов. */
export function genresFromGoogle(categories: string[]): string[] {
  const out: string[] = [];
  const parts = categories.flatMap((c) => c.split(/\s*\/\s*|\s*&\s*/)).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const hit = RULES.find((r) => r.re.test(p));
    if (hit && !out.includes(hit.genre)) out.push(hit.genre);
  }
  // Если есть и конкретный жанр, и общий «Художественная литература» — общий не нужен.
  if (out.length > 1) return out.filter((g) => g !== GOOGLE_GENRE_FALLBACK).slice(0, 4);
  return out.slice(0, 4);
}

/** Если Google не дал категорий — угадываем по названию и описанию. */
export function genresFromText(text: string): string[] {
  const out: string[] = [];
  for (const r of RULES) {
    if (r.genre === GOOGLE_GENRE_FALLBACK) continue;
    if (r.re.test(text) && !out.includes(r.genre)) out.push(r.genre);
    if (out.length >= 2) break;
  }
  return out;
}

/** Категория объявления (книга / учебник / манга) по категориям Google. */
export function categoryFromGoogle(categories: string[]): Category | null {
  const s = categories.join(" / ");
  if (/comics|graphic novel|manga|манга/i.test(s)) return "manga";
  if (/textbook|study aids|education|учебник/i.test(s)) return "textbook";
  return null;
}
