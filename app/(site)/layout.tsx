import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Обычный сайт: общая шапка и подвал.
// Панели /admin и /moderation лежат вне этой группы — у них своя оболочка (StaffShell).
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
