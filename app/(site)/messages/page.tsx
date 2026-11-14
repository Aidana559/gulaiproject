import { Suspense } from "react";
import MessagesView from "@/components/MessagesView";

export const metadata = { title: "Сообщения — Kitapta" };

export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-stone-900">Сообщения</h1>
      <p className="mt-2 mb-6 text-stone-500">Переписка с владельцами книг и читателями.</p>
      <Suspense fallback={null}>
        <MessagesView />
      </Suspense>
    </div>
  );
}
