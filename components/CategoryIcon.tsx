import { FiBook, FiFileText, FiLayers, FiTag } from "react-icons/fi";
import { LuGraduationCap } from "react-icons/lu";
import type { Category } from "@/data/books";

// Значки встроенных категорий; у добавленных администратором — универсальный значок
const icons: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  book: FiBook,
  textbook: LuGraduationCap,
  guide: FiFileText,
  manga: FiLayers,
};

export default function CategoryIcon({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const Icon = icons[category] ?? FiTag;
  return <Icon className={className} aria-hidden />;
}
