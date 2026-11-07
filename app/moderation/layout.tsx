import StaffGuard from "@/components/staff/StaffGuard";

// Панель модератора: только для роли moderator (админу здесь делать нечего — у него своя панель).
export default function ModerationLayout({ children }: { children: React.ReactNode }) {
  return <StaffGuard role="moderator">{children}</StaffGuard>;
}
