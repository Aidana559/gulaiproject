"use client";

/**
 * Мгновенное обновление статусов книг между вкладками одного браузера.
 * После бронирования, выдачи, возврата или отмены вызывающий код сообщает `announceBookingsChanged()`,
 * а открытые вкладки (профиль пользователя, каталог) сразу перечитывают статусы с сервера.
 * Сами статусы всегда считаются на сервере по броням (lib/bookings.ts), здесь передаётся только сигнал.
 * Для других устройств и браузеров профиль дополнительно обновляется по таймеру и при возврате на вкладку.
 */
const CHANNEL = "kitapta:bookings";
const STORAGE_KEY = "kitapta:bookings:changed";

export function announceBookingsChanged(): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage("changed");
      ch.close();
    }
  } catch {
    /* сигнал не критичен */
  }
  try {
    // запасной путь для браузеров без BroadcastChannel: событие storage приходит в ДРУГИЕ вкладки
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* localStorage недоступен */
  }
}

/** Подписка на сигнал из других вкладок. Возвращает функцию отписки. */
export function subscribeBookingsChanged(cb: () => void): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = () => cb();
    }
  } catch {
    ch = null;
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    ch?.close();
    window.removeEventListener("storage", onStorage);
  };
}
