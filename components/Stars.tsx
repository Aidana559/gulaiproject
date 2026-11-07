"use client";

import { FaStar } from "react-icons/fa";

export function Stars({
  value,
  onChange,
  className = "text-xl",
}: {
  value: number;
  onChange?: (v: number) => void;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role={onChange ? "group" : "img"}
      aria-label={`Оценка ${value} из 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <FaStar className={n <= Math.round(value) ? "text-yellow-500" : "text-gray-300"} />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} из 5`}
            className="px-0.5"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}
