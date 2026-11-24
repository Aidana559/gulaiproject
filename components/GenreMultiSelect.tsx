"use client";

import { useMemo, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { useTaxonomy } from "./TaxonomyProvider";
import { MAX_GENRES } from "@/lib/moderation-shared";
import { inputClass } from "./FormField";

const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Выбор нескольких жанров для одной книги: список жанров (статические + добавленные админом),
 * свой жанр вводится вручную. Повторы (без учёта регистра) не добавляются.
 * Значения уходят в форму скрытыми полями `genres` (по одному на жанр).
 */
export default function GenreMultiSelect({
  value,
  onChange,
  name = "genres",
  id = "genres",
  className = inputClass,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  name?: string;
  id?: string;
  className?: string;
}) {
  const { genres: taxGenres } = useTaxonomy();
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");


  // список жанров задаёт администратор (раздел «Жанры» в админ-панели)
  const options = useMemo(
    () => Array.from(new Set(taxGenres.map((g) => g.name))).sort((a, b) => a.localeCompare(b, "ru")),
    [taxGenres],
  );
  const has = (g: string) => value.some((x) => x.toLowerCase() === g.toLowerCase());
  const available = options.filter((g) => !has(g));

  function add(raw: string) {
    const g = normalize(raw).slice(0, 60);
    if (!g) return;
    if (has(g)) {
      setNote(`Жанр «${g}» уже добавлен`);
      return;
    }
    if (value.length >= MAX_GENRES) {
      setNote(`Не больше ${MAX_GENRES} жанров`);
      return;
    }
    setNote("");
    onChange([...value, g]);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Выбранные жанры">
          {value.map((g) => (
            <li
              key={g}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
            >
              {g}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== g))}
                aria-label={`Убрать жанр ${g}`}
                className="rounded-full p-0.5 hover:bg-indigo-200"
              >
                <FiX />
              </button>
            </li>
          ))}
        </ul>
      )}

      <select
        id={id}
        className={className}
        value=""
        onChange={(e) => {
          if (e.target.value) add(e.target.value);
        }}
        aria-label="Добавить жанр"
      >
        <option value="">{value.length ? "Добавить ещё жанр…" : "Выберите жанр"}</option>
        {available.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          className={className}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // чтобы не отправить форму
              add(custom);
              setCustom("");
            }
          }}
          placeholder="Или введите свой жанр"
          maxLength={60}
          aria-label="Свой жанр"
        />
        <button
          type="button"
          onClick={() => {
            add(custom);
            setCustom("");
          }}
          disabled={!custom.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
        >
          <FiPlus /> Добавить
        </button>
      </div>
      {note && (
        <p role="status" className="text-xs text-amber-700">
          {note}
        </p>
      )}

      {value.map((g) => (
        <input key={g} type="hidden" name={name} value={g} />
      ))}
      <input type="hidden" name="genresPresent" value="1" />
    </div>
  );
}
