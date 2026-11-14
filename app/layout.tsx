import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Kitapta — студенческий буккроссинг",
  description: "Kitapta — студенческая платформа для обмена книгами.",
  applicationName: "Kitapta",
  openGraph: {
    title: "Kitapta — студенческий буккроссинг",
    description: "Kitapta — студенческая платформа для обмена книгами.",
    siteName: "Kitapta",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
