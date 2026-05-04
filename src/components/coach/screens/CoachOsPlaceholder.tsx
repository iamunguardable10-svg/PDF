export function CoachOsPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">TeamLoad Coach OS</p>
      <h2 className="mt-2 text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">This screen is prepared for the next implementation phase.</p>
    </div>
  );
}
