"use client";

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
    <span className={className} aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <span className={filled ? "text-yellow-500" : "text-gray-300"}>★</span>
        );
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} className="px-0.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}