import { FiBook, FiFileText, FiLayers } from "react-icons/fi";
import { LuGraduationCap } from "react-icons/lu";
import type { Category } from "@/data/books";

const icons = {
  book: FiBook,
  textbook: LuGraduationCap,
  guide: FiFileText,
  manga: FiLayers,
} as const;

export default function CategoryIcon({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const Icon = icons[category];
  return <Icon className={className} aria-hidden />;
}
