import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth";
import StaffShell, { type StaffRole } from "./StaffShell";

async function Guard({ role, children }: { role: StaffRole; children: React.ReactNode }) {
  await connection(); 
  const user = await getSessionUser();

  if (!user) redirect("/login");
  if (user.role !== role) {
    redirect(
      user.role === "admin" ? "/admin" : user.role === "moderator" ? "/moderation/queue" : "/",
    );
  }

  return <StaffShell role={role}>{children}</StaffShell>;
}

export default function StaffGuard({
  role,
  children,
}: {
  role: StaffRole;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-stone-500">Загрузка…</div>
      }
    >
      <Guard role={role}>{children}</Guard>
    </Suspense>
  );
}