import type { InputHTMLAttributes, ReactNode } from "react";

const base =
  "block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm";

export function Field({
  label,
  id,
  ...props
}: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input id={id} name={id} className={base} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <select id={id} name={id} className={base}>
        {children}
      </select>
    </div>
  );
}

export function TextArea({ label, id, rows = 4 }: { label: string; id: string; rows?: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <textarea id={id} name={id} rows={rows} className={base} />
    </div>
  );
}

export { base as inputClass };