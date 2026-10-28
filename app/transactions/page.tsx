import TransactionsView from "@/components/TransactionsView";

export const metadata = { title: "Транзакции — Page2Page" };

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-stone-900">Транзакции</h1>
      <p className="mt-2 mb-8 text-stone-500">
        Кто взял книгу, кто хочет взять (бронь) и когда её нужно вернуть.
      </p>
      <TransactionsView />
    </div>
  );
}