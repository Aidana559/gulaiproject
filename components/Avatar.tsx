export default function Avatar({
  name,
  src,
  className = "size-10 text-base",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`rounded-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-teal-800 font-bold text-white ${className}`}>
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}