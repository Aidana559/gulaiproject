import StaffGuard from "@/components/staff/StaffGuard";

// Панель администратора: только для роли admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffGuard role="admin">{children}</StaffGuard>;
}
