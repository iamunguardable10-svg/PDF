export function CoachOsPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">TeamLoad Coach OS</p>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-400">
        {description ?? 'This screen is prepared for the next implementation phase.'}
      </p>
    </div>
  );
}
