"use client";

import { useEffect, useMemo, useState } from "react";
import { genres as staticGenres } from "@/data/books";
import { inputClass } from "./FormField";

const OTHER = "__other__";

/**
 * Выбор жанра из списка (статические жанры + добавленные админом).
 * Пункт «Другой жанр…» открывает поле для своего значения.
 * Значение уходит в форму через скрытое поле с именем `name`.
 */
export default function GenreSelect({
  name = "genre",
  value,
  onChange,
  id = "genre",
  className = inputClass,
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
}) {
  const [extra, setExtra] = useState<string[]>([]);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    fetch("/api/genres")
      .then((r) => r.json())
      .then((g: unknown) => {
        const list = Array.isArray(g) ? g : [];
        setExtra(
          list
            .filter((x): x is { name: string; type: string } => !!x && typeof x.name === "string")
            .filter((x) => x.type === "genre")
            .map((x) => x.name),
        );
      })
      .catch(() => {});
  }, []);

  const options = useMemo(
    () => Array.from(new Set([...staticGenres, ...extra])).sort((a, b) => a.localeCompare(b, "ru")),
    [extra],
  );

  // текущее значение вне списка (например, у старой книги) — показываем как «другое»
  const isCustom = custom || (value !== "" && value !== "—" && !options.includes(value));

  return (
    <div className="space-y-2">
      <select
        id={id}
        className={className}
        value={isCustom ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Выберите жанр</option>
        {options.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
        <option value={OTHER}>Другой жанр…</option>
      </select>
      {isCustom && (
        <input
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Введите свой жанр"
          maxLength={60}
          autoFocus={custom}
        />
      )}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
