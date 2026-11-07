export type MuteInfo = {
  muted?: boolean;
  mutedUntil?: string | null;
};

export function isMutedNow(u?: MuteInfo | null, now = Date.now()): boolean {
  if (!u?.muted) return false;
  if (!u.mutedUntil) return true;
  return new Date(u.mutedUntil).getTime() > now;
}

export function muteLabel(u?: MuteInfo | null): string {
  if (!u?.mutedUntil) return "навсегда";
  const d = new Date(u.mutedUntil);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `до ${dd}.${mm}.${d.getFullYear()}`;
}