"use client";


const CHANNEL = "kitapta:bookings";
const STORAGE_KEY = "kitapta:bookings:changed";
const WINDOW_EVENT = "kitapta:bookings-changed";

export function announceBookingsChanged(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(WINDOW_EVENT));
    }
  } catch {

  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage("changed");
      ch.close();
    }
  } catch {

  }
  try {
  
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {

  }
}

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
  const onWindow = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(WINDOW_EVENT, onWindow);
  return () => {
    ch?.close();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(WINDOW_EVENT, onWindow);
  };
}