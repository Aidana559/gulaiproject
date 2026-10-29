import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Page2Page — студенческий буккроссинг",
  description: "Обмен книгами, учебниками, методичками и мангой между студентами.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        <AuthProvider>
        <Navbar />
        <main>{children}</main>
        <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}