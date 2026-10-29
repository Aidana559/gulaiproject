import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-indigo-600",
  secondary:
    "bg-amber-400 text-stone-900 shadow-sm hover:bg-amber-300 focus-visible:outline-amber-500",
  outline:
    "bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 focus-visible:outline-indigo-600",
  ghost: "text-indigo-700 hover:bg-indigo-50 focus-visible:outline-indigo-600",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:outline-rose-600",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

interface Common {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

function classes({ variant = "primary", size = "md", full, className = "" }: Common) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    full ? "w-full" : "",
    className,
  ].join(" ");
}

/** Кнопка-ссылка */
export function LinkButton({ href, ...props }: Common & { href: string }) {
  return (
    <Link href={href} className={classes(props)}>
      {props.children}
    </Link>
  );
}

/** Обычная кнопка */
export function Button({
  variant,
  size,
  full,
  className,
  children,
  ...rest
}: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Common>) {
  return (
    <button className={classes({ variant, size, full, className, children })} {...rest}>
      {children}
    </button>
  );
}