"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CANONICAL_GENRES,
  DEFAULT_CATEGORIES,
  setCategoryRegistry,
  setGenreRegistry,
  type CategoryDef,
} from "@/lib/categories";

export type GenreDef = { id: string; name: string };
type Taxonomy = { categories: CategoryDef[]; genres: GenreDef[] };

type Ctx = Taxonomy & { loaded: boolean; refresh: () => Promise<void> };

const DEFAULTS: Taxonomy = {
  categories: DEFAULT_CATEGORIES,
  genres: CANONICAL_GENRES.map((name, i) => ({ id: `g${i + 1}`, name })),
};

const TaxonomyContext = createContext<Ctx>({ ...DEFAULTS, loaded: false, refresh: async () => {} });

/**
 * Категории и жанры, которыми управляет администратор. Загружаются с сервера и обновляют общий реестр
 * (lib/categories.ts), поэтому подписи категорий и названия жанров на сайте всегда актуальны.
 * Пока данные не пришли, действуют значения по умолчанию.
 */
export function TaxonomyProvider({ children }: { children: ReactNode }) {
  const [tax, setTax] = useState<Taxonomy>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/taxonomy", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as Taxonomy;
      if (!Array.isArray(json.categories) || !Array.isArray(json.genres)) return;
      setCategoryRegistry(json.categories);
      setGenreRegistry(json.genres.map((g) => g.name));
      setTax({ categories: json.categories, genres: json.genres });
    } catch {
      /* остаются прежние значения */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    // другой администратор мог изменить списки — при возврате на вкладку перечитываем
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = useMemo(() => ({ ...tax, loaded, refresh }), [tax, loaded, refresh]);
  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export const useTaxonomy = () => useContext(TaxonomyContext);
