import {
  FiBook,
  FiBookOpen,
  FiFileText,
  FiLayers,
  FiTag,
  FiClipboard,
  FiGrid,
  FiFeather,
  FiArchive,
  FiFolder,
  FiBookmark,
  FiGlobe,
  FiMusic,
  FiCamera,
  FiCpu,
  FiMap,
} from "react-icons/fi";
import { LuGraduationCap, LuNewspaper, LuScrollText } from "react-icons/lu";
import type { Category } from "@/data/books";
import type { ComponentType } from "react";

export type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export const ICON_SIZE_SM = "h-4 w-4 shrink-0";
export const ICON_SIZE_MD = "h-5 w-5 shrink-0";
export const ICON_SIZE_LG = "h-6 w-6 shrink-0";


export const CATEGORY_ICON_CATALOG: { key: string; label: string; Icon: IconComponent }[] = [
  { key: "book", label: "Книга", Icon: FiBook },
  { key: "book-open", label: "Открытая книга", Icon: FiBookOpen },
  { key: "graduation", label: "Учёба", Icon: LuGraduationCap },
  { key: "file-text", label: "Документ", Icon: FiFileText },
  { key: "scroll", label: "Методичка", Icon: LuScrollText },
  { key: "layers", label: "Манга", Icon: FiLayers },
  { key: "newspaper", label: "Журнал", Icon: LuNewspaper },
  { key: "clipboard", label: "Планшет", Icon: FiClipboard },
  { key: "grid", label: "Сетка", Icon: FiGrid },
  { key: "feather", label: "Перо", Icon: FiFeather },
  { key: "archive", label: "Архив", Icon: FiArchive },
  { key: "folder", label: "Папка", Icon: FiFolder },
  { key: "bookmark", label: "Закладка", Icon: FiBookmark },
  { key: "globe", label: "Мир", Icon: FiGlobe },
  { key: "music", label: "Музыка", Icon: FiMusic },
  { key: "camera", label: "Фото", Icon: FiCamera },
  { key: "cpu", label: "Техника", Icon: FiCpu },
  { key: "map", label: "Карта", Icon: FiMap },
  { key: "tag", label: "Метка", Icon: FiTag },
];

const byKey: Record<string, IconComponent> = Object.fromEntries(
  CATEGORY_ICON_CATALOG.map((e) => [e.key, e.Icon]),
);


const DEFAULT_BY_CATEGORY: Record<string, string> = {
  book: "book",
  textbook: "graduation",
  guide: "file-text",
  manga: "layers",
  zhurnaly: "newspaper",
  journal: "newspaper",
  magazine: "newspaper",
};

export const FALLBACK_CATEGORY_ICON_KEY = "tag";
export const FallbackCategoryIcon = FiTag;

export function resolveCategoryIconKey(categoryKey: string, iconFromTaxonomy?: string | null): string {
  if (iconFromTaxonomy && byKey[iconFromTaxonomy]) return iconFromTaxonomy;
  if (DEFAULT_BY_CATEGORY[categoryKey]) return DEFAULT_BY_CATEGORY[categoryKey];
  return FALLBACK_CATEGORY_ICON_KEY;
}

export function getCategoryIconComponent(iconKey: string | null | undefined): IconComponent {
  if (iconKey && byKey[iconKey]) return byKey[iconKey];
  return FallbackCategoryIcon;
}

type Props = {
  category: Category;
  icon?: string | null;
  className?: string;
};

export default function CategoryIcon({ category, icon, className }: Props) {
  const key = resolveCategoryIconKey(String(category ?? ""), icon);
  const Icon = getCategoryIconComponent(key);
  return <Icon className={className} aria-hidden />;
}
