"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { NotifItem } from "@/lib/notification-ui";

/**
 * Одно общее хранилище оповещений для всех колокольчиков на странице.
 * В Navbar колокольчик отрисован дважды (десктоп и мобильное меню, скрывается только CSS), и каждый
 * сам опрашивал /api/notifications каждые 30 секунд — запросы шли парами. Теперь на всех один запрос
 * и один таймер; пока вкладка скрыта, опрос не идёт.
 */
export type NotifState = { items: NotifItem[]; unread: number; counts: Record<string, number> };

const POLL_MS = 30_000;
const EMPTY: NotifState = { items: [], unread: 0, counts: {} };

let state: NotifState = EMPTY;
let owner: string | null = null; // чьи оповещения сейчас в хранилище (защита при смене аккаунта)
let subs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
let lastLoadAt = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/**
 * Загружает непрочитанные оповещения. Параллельные вызовы объединяются в один запрос.
 * force — нужен свежий ответ (например, после «прочитано»): если запрос уже идёт, делаем ещё один следом.
 */
export function loadNotifications(force = false): Promise<void> {
  if (inflight) return force ? inflight.then(() => loadNotifications()) : inflight;
  const forOwner = owner;
  inflight = (async () => {
    try {
      // в выпадающем списке — только непрочитанные; прочитанные остаются на странице «Все оповещения»
      const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
      if (!res.ok || forOwner !== owner) return; // ответ для прежнего аккаунта не показываем
      const json = await res.json();
      state = {
        items: Array.isArray(json.items) ? json.items : [],
        unread: Number(json.unread) || 0,
        counts: json.counts && typeof json.counts === "object" ? json.counts : {},
      };
      lastLoadAt = Date.now();
      emit();
    } catch {
      /* сеть недоступна — оставляем прежний список */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function onVisible() {
  if (document.visibilityState === "visible" && Date.now() - lastLoadAt > POLL_MS / 2) void loadNotifications();
}

function acquire(userKey: string) {
  if (owner !== userKey) {
    owner = userKey;
    state = EMPTY;
    lastLoadAt = 0;
    emit();
  }
  subs++;
  if (subs === 1) {
    timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  void loadNotifications();
  return () => {
    subs--;
    if (subs === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
      owner = null;
      state = EMPTY; // вышли или ушли со страницы — чужих оповещений не оставляем
    }
  };
}

/** userKey — id пользователя; null, если не вошёл (опроса нет). */
export function useNotifications(userKey: string | null): NotifState {
  useEffect(() => {
    if (!userKey) return;
    return acquire(userKey);
  }, [userKey]);
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
