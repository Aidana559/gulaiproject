export default function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-stone-900 sm:text-3xl">{title}</h1>
      {hint && <p className="mt-1 text-stone-500">{hint}</p>}
    </div>
  );
}
