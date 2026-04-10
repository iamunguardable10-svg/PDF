import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, Tooltip, ResponsiveContainer } from 'recharts';
import type { ManagedAthlete, AthleteGroup, AthleteStatus, ACWRZone, SelectionStats } from '../types/trainerDashboard';
import {
  loadRoster, saveRoster, extractToken,
  computeAthleteStatus, computeSelectionStats,
  generateAlerts, sortStatuses, groupColor, GROUP_COLORS,
  type SortMode, type CoachAlert,
} from '../lib/trainerRoster';
import { fetchLiveTrainerData, createTrainerInvite, listAcceptedInvites, listPendingInvites, deleteInvite } from '../lib/trainerShare';
import { CLOUD_ENABLED } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { TrainerView } from './TrainerView';

// ── Helpers ──────────────────────────────────────────────────────────────────

function zoneStyle(zone: ACWRZone): { bg: string; text: string; label: string } {
  switch (zone) {
    case 'optimal':  return { bg: '#14532d', text: '#4ade80', label: 'Optimal' };
    case 'elevated': return { bg: '#451a03', text: '#fb923c', label: 'Erhöht' };
    case 'high':     return { bg: '#450a0a', text: '#f87171', label: 'Hoch' };
    case 'low':      return { bg: '#1e3a5f', text: '#60a5fa', label: 'Niedrig' };
    case 'building': return { bg: '#1e1b4b', text: '#a5b4fc', label: 'Aufbau' };
    default:         return { bg: '#1f2937', text: '#6b7280', label: 'Keine Daten' };
  }
}

function ZoneBadge({ zone }: { zone: ACWRZone }) {
  const s = zoneStyle(zone);
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function TrendIcon({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  if (Math.abs(trend) < 0.05) return <span className="text-gray-500 text-xs">→</span>;
  return trend > 0
    ? <span className="text-red-400 text-xs">↑ +{trend.toFixed(2)}</span>
    : <span className="text-blue-400 text-xs">↓ {trend.toFixed(2)}</span>;
}

// ── Add Athlete Modal ────────────────────────────────────────────────────────

interface AddModalProps {
  groups: AthleteGroup[];
  onAdd: (athlete: ManagedAthlete) => void;
  onClose: () => void;
}

function AddAthleteModal({ groups, onAdd, onClose }: AddModalProps) {
  const [input, setInput]     = useState('');
  const [groupId, setGroupId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [preview, setPreview] = useState<{ name: string; sport: string } | null>(null);
  const [error, setError]     = useState('');

  const handleVerify = async () => {
    const token = extractToken(input);
    if (!token) { setError('Ungültiger Link oder Token'); return; }
    setVerifying(true);
    setError('');
    const data = await fetchLiveTrainerData(token);
    if (!data) { setError('Daten konnten nicht geladen werden. Token gültig?'); setVerifying(false); return; }
    setPreview({ name: data.athleteName, sport: data.sport });
    setVerifying(false);
  };

  const handleAdd = async () => {
    const token = extractToken(input)!;
    const data = await fetchLiveTrainerData(token);
    if (!data) { setError('Fehler beim Laden'); return; }
    const athlete: ManagedAthlete = {
      id:       crypto.randomUUID(),
      name:     data.athleteName,
      sport:    data.sport || '',
      token,
      groupIds: groupId ? [groupId] : [],
      addedAt:  new Date().toISOString().split('T')[0],
    };
    onAdd(athlete);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-white font-bold text-base">Athleten hinzufügen</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Live-Link oder Token</label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"
                placeholder="https://… oder live_abc123"
                value={input} onChange={e => { setInput(e.target.value); setPreview(null); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && !preview && handleVerify()}
              />
              {!preview && (
                <button onClick={handleVerify} disabled={verifying || !input.trim()}
                  className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm rounded-xl transition-colors shrink-0">
                  {verifying ? '…' : 'Prüfen'}
                </button>
              )}
            </div>
          </div>

          {preview && (
            <div className="bg-gray-800/60 border border-green-800/40 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xs">✓</span>
                <span className="text-white font-semibold text-sm">{preview.name}</span>
                {preview.sport && <span className="text-gray-400 text-xs">{preview.sport}</span>}
              </div>
              <p className="text-xs text-gray-500">Daten erfolgreich geladen</p>
            </div>
          )}

          {groups.length > 0 && preview && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Gruppe (optional)</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
                value={groupId} onChange={e => setGroupId(e.target.value)}
              >
                <option value="">Keine</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors">
            Abbrechen
          </button>
          <button onClick={preview ? handleAdd : handleVerify}
            disabled={verifying || !input.trim()}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {preview ? 'Hinzufügen' : verifying ? 'Prüfe…' : 'Weiter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Group Modal ───────────────────────────────────────────────────────

interface CreateGroupModalProps {
  onAdd: (group: AthleteGroup) => void;
  onClose: () => void;
}

function CreateGroupModal({ onAdd, onClose }: CreateGroupModalProps) {
  const [name, setName]   = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0].key);

  const handleCreate = () => {
    if (!name.trim()) return;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), color });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-bold text-base">Gruppe erstellen</h3>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Name</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"
            placeholder="A-Kader, Reha, U19…"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {GROUP_COLORS.map(c => (
              <button key={c.key}
                onClick={() => setColor(c.key)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c.bg,
                  borderColor: color === c.key ? '#fff' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors">
            Abbrechen
          </button>
          <button onClick={handleCreate} disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Athlete Card ─────────────────────────────────────────────────────────────

interface AthleteCardProps {
  status: AthleteStatus;
  groups: AthleteGroup[];
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onRemove: () => void;
}

function AthleteCard({ status, groups, selected, onSelect, onClick, onRemove }: AthleteCardProps) {
  const myGroups = groups.filter(g => status.groupIds.includes(g.id));

  return (
    <div
      className={`relative bg-gray-900 border rounded-2xl p-4 transition-all cursor-pointer ${
        selected ? 'border-violet-500/60 bg-violet-950/20' : 'border-gray-800 hover:border-gray-700'
      }`}
      onClick={onClick}
    >
      {/* Select checkbox */}
      <button
        className="absolute top-3 right-3 z-10"
        onClick={e => { e.stopPropagation(); onSelect(); }}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
          selected ? 'bg-violet-600 border-violet-600' : 'border-gray-600 hover:border-gray-400'
        }`}>
          {selected && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l3 3 5-6"/></svg>}
        </div>
      </button>

      <div className="pr-6">
        {/* Name + status */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-white font-semibold text-sm">{status.name}</span>
          {status.sport && <span className="text-gray-500 text-xs">{status.sport}</span>}
          {status.loading && <span className="text-gray-600 text-xs">Laden…</span>}
          {status.error  && <span className="text-red-500 text-xs">Fehler</span>}
        </div>

        {/* ACWR row */}
        {!status.loading && !status.error && (
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {status.acwr !== null ? (
              <>
                <span className="text-xl font-bold text-white">{status.acwr.toFixed(2)}</span>
                <ZoneBadge zone={status.zone} />
                <TrendIcon trend={status.trend} />
              </>
            ) : (
              <span className="text-gray-600 text-sm">Keine ACWR-Daten</span>
            )}
          </div>
        )}

        {/* Loads */}
        {!status.loading && !status.error && status.acwr !== null && (
          <div className="flex gap-3 text-xs text-gray-500 mb-2">
            <span>Akut: <span className="text-sky-400 font-medium">{status.acuteLoad}</span></span>
            <span>Chronisch: <span className="text-amber-400 font-medium">{status.chronicLoad}</span></span>
            {status.lastLoadDate && <span>Stand: {status.lastLoadDate}</span>}
          </div>
        )}

        {/* Groups */}
        {myGroups.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {myGroups.map(g => {
              const c = groupColor(g.color);
              return (
                <span key={g.id} className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: c.bg + '30', color: c.light, border: `1px solid ${c.bg}50` }}>
                  {g.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove */}
      <button
        className="absolute bottom-3 right-3 text-gray-700 hover:text-red-500 transition-colors text-xs"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        title="Entfernen"
      >
        ✕
      </button>
    </div>
  );
}

// ── Avg ACWR Chart ────────────────────────────────────────────────────────────

function fmtChartDate(iso: string) {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
}

interface AvgACWRChartProps {
  history: { date: string; acwr: number }[];
  label: string;
  accentColor?: string;
}

function AvgACWRChart({ history, label, accentColor = '#a78bfa' }: AvgACWRChartProps) {
  if (history.length < 3) return (
    <div className="text-xs text-gray-600 text-center py-4">
      Zu wenig Verlaufsdaten für einen Graphen (mind. 3 gemeinsame Tage nötig).
    </div>
  );

  // Last 30 days
  const data = history.slice(-30);
  const yMin = Math.max(0.3, Math.min(...data.map(d => d.acwr)) - 0.1);
  const yMax = Math.min(2.0, Math.max(...data.map(d => d.acwr)) + 0.1);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Ø ACWR – {label}</span>
        <span className="text-xs text-gray-600">{data.length} Tage</span>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            {/* Optimal zone */}
            <ReferenceArea y1={0.8} y2={1.3} fill="#14532d" fillOpacity={0.25} />
            <ReferenceLine y={0.8} stroke="#4ade80" strokeOpacity={0.3} strokeDasharray="3 3" />
            <ReferenceLine y={1.3} stroke="#f87171" strokeOpacity={0.3} strokeDasharray="3 3" />

            <XAxis dataKey="date" tickFormatter={fmtChartDate}
              tick={{ fill: '#4b5563', fontSize: 9 }} tickLine={false} axisLine={false}
              interval={Math.floor(data.length / 4)} />
            <YAxis domain={[yMin, yMax]}
              tick={{ fill: '#4b5563', fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => v.toFixed(1)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 10, fontSize: 11 }}
              labelFormatter={(l: unknown) => fmtChartDate(l as string)}
              formatter={(v: unknown) => [(v as number).toFixed(2), 'Ø ACWR']}
            />
            <Line
              type="monotone" dataKey="acwr" stroke={accentColor}
              strokeWidth={2} dot={false} activeDot={{ r: 3, fill: accentColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Athlete roster list (accordion row, reused in Übersicht + Gruppen) ─────────

interface RosterListProps {
  statuses: AthleteStatus[];
  label: string;
  accentColor?: string;
  onOpenAthlete: (token: string) => void;
}

function RosterList({ statuses, label, accentColor, onOpenAthlete }: RosterListProps) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => sortStatuses(statuses, 'risk'), [statuses]);

  return (
    <div className="border border-gray-800 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {accentColor && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />}
          <span className="text-white font-semibold text-sm">{label}</span>
          <span className="text-gray-600 text-xs">{statuses.length} Athleten</span>
        </div>
        <span className={`text-gray-500 text-xs transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="border-t border-gray-800">
          {sorted.map(s => (
            <button
              key={s.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0 hover:bg-white/[0.02] transition-colors text-left"
              onClick={() => onOpenAthlete(s.token)}
            >
              <span className="text-white text-sm flex-1 truncate">{s.name}</span>
              {s.loading && <span className="text-gray-600 text-xs">…</span>}
              {s.error   && <span className="text-red-500 text-xs">Fehler</span>}
              {!s.loading && !s.error && s.acwr !== null && (
                <>
                  <span className="text-gray-400 text-xs font-mono">{s.acwr.toFixed(2)}</span>
                  <ZoneBadge zone={s.zone} />
                  <TrendIcon trend={s.trend} />
                </>
              )}
              {!s.loading && !s.error && s.acwr === null && (
                <ZoneBadge zone={s.zone} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Selection Stats Panel ────────────────────────────────────────────────────

function StatsPanel({ stats, label }: { stats: SelectionStats; label: string }) {
  const zones: ACWRZone[] = ['optimal', 'elevated', 'high', 'low', 'building', 'nodata'];

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label} · {stats.count} Athleten</div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">Ø ACWR</div>
          <div className="text-lg font-bold text-white">{stats.avgAcwr?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">Ø Akut</div>
          <div className="text-lg font-bold text-sky-400">{stats.avgAcute}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">Ø Chronisch</div>
          <div className="text-lg font-bold text-amber-400">{stats.avgChronic}</div>
        </div>
      </div>

      {/* Zone breakdown */}
      <div className="flex gap-1.5 flex-wrap">
        {zones.map(z => {
          const count = stats.zoneBreakdown[z];
          if (count === 0) return null;
          const s = zoneStyle(z);
          return (
            <span key={z} className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: s.bg, color: s.text }}>
              {s.label}: {count}
            </span>
          );
        })}
      </div>

      {stats.riskCount > 0 && (
        <div className="text-xs text-orange-400">
          ⚠ {stats.riskCount} Athlet{stats.riskCount !== 1 ? 'en' : ''} mit erhöhtem Risiko
        </div>
      )}
    </div>
  );
}

// ── Alert Panel (collapsible, fixed bottom) ───────────────────────────────────

function AlertPanel({ alerts }: { alerts: CoachAlert[] }) {
  const [open, setOpen] = useState(false);
  const [expandedAthlete, setExpandedAthlete] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  const critical = alerts.filter(a => a.level === 'critical');
  const warnings = alerts.filter(a => a.level === 'warning');
  const infos    = alerts.filter(a => a.level === 'info');

  // Group by athlete
  const byAthlete = new Map<string, CoachAlert[]>();
  for (const a of alerts) {
    if (!byAthlete.has(a.athleteId)) byAthlete.set(a.athleteId, []);
    byAthlete.get(a.athleteId)!.push(a);
  }

  const levelIcon = (level: CoachAlert['level']) =>
    level === 'critical' ? '🔴' : level === 'warning' ? '⚠' : 'ℹ';
  const levelColor = (level: CoachAlert['level']) =>
    level === 'critical' ? 'text-red-300' : level === 'warning' ? 'text-orange-300' : 'text-blue-300';
  const levelBg = (level: CoachAlert['level']) =>
    level === 'critical' ? 'bg-red-950/40 border-red-800/30' : level === 'warning' ? 'bg-orange-950/40 border-orange-800/30' : 'bg-blue-950/40 border-blue-800/30';

  const topLevel = critical.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'info';

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4 pb-4 pointer-events-auto">

        {/* Expanded panel */}
        {open && (
          <div className="mb-2 bg-gray-900/98 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <span className="text-white text-sm font-semibold">
                Hinweise & Warnungen
              </span>
              <div className="flex gap-3 text-xs text-gray-500">
                {critical.length > 0 && <span className="text-red-400">{critical.length} kritisch</span>}
                {warnings.length > 0 && <span className="text-orange-400">{warnings.length} Warnung{warnings.length !== 1 ? 'en' : ''}</span>}
                {infos.length > 0    && <span className="text-blue-400">{infos.length} Info{infos.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>

            <div className="overflow-y-auto">
              {Array.from(byAthlete.entries()).map(([athleteId, athleteAlerts]) => {
                const name = athleteAlerts[0].athleteName;
                const isExpanded = expandedAthlete === athleteId;
                const worstLevel = athleteAlerts[0].level; // already sorted critical→warning→info

                return (
                  <div key={athleteId} className="border-b border-gray-800/60 last:border-0">
                    {/* Athlete row */}
                    <button
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                      onClick={() => setExpandedAthlete(isExpanded ? null : athleteId)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm shrink-0">{levelIcon(worstLevel)}</span>
                        <span className={`text-sm font-medium truncate ${levelColor(worstLevel)}`}>{name}</span>
                        <span className="text-gray-600 text-xs shrink-0">{athleteAlerts.length} Hinweis{athleteAlerts.length !== 1 ? 'e' : ''}</span>
                      </div>
                      <span className={`text-gray-500 text-xs shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {/* Per-athlete alerts */}
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-1.5 pl-10">
                        {athleteAlerts.map((a, i) => (
                          <div key={i} className={`text-xs px-3 py-2 rounded-xl border ${levelBg(a.level)}`}>
                            <span className={levelColor(a.level)}>{a.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compact toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border shadow-lg transition-all ${
            topLevel === 'critical'
              ? 'bg-red-950/90 border-red-800/60 hover:bg-red-950'
              : topLevel === 'warning'
              ? 'bg-orange-950/90 border-orange-800/60 hover:bg-orange-950'
              : 'bg-blue-950/90 border-blue-800/60 hover:bg-blue-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-sm">{levelIcon(topLevel)}</span>
            <span className={`text-sm font-medium ${topLevel === 'critical' ? 'text-red-300' : topLevel === 'warning' ? 'text-orange-300' : 'text-blue-300'}`}>
              {byAthlete.size} Athlet{byAthlete.size !== 1 ? 'en' : ''} mit Hinweisen
            </span>
            <div className="flex gap-1.5">
              {critical.length > 0 && (
                <span className="text-xs bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded-full">{critical.length}×🔴</span>
              )}
              {warnings.length > 0 && (
                <span className="text-xs bg-orange-900/60 text-orange-300 px-1.5 py-0.5 rounded-full">{warnings.length}×⚠</span>
              )}
              {infos.length > 0 && (
                <span className="text-xs bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded-full">{infos.length}×ℹ</span>
              )}
            </div>
          </div>
          <span className={`text-xs shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${topLevel === 'critical' ? 'text-red-500' : topLevel === 'warning' ? 'text-orange-500' : 'text-blue-500'}`}>▲</span>
        </button>
      </div>
    </div>
  );
}

// ── Add Athlete Dropdown ──────────────────────────────────────────────────────

function AddAthleteDropdown({ cloudEnabled, onInvite, onManual }: {
  cloudEnabled: boolean;
  onInvite: () => void;
  onManual: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium flex items-center gap-1"
      >
        + Athlet <span className={`transition-transform text-[10px] ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-xl z-20 overflow-hidden">
          {cloudEnabled && (
            <button
              onClick={() => { setOpen(false); onInvite(); }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-gray-800"
            >
              <span className="text-violet-400 mt-0.5">🔗</span>
              <div>
                <div className="text-white text-xs font-medium">Einladen</div>
                <div className="text-gray-500 text-xs">Link generieren, Athlet bestätigt</div>
              </div>
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onManual(); }}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
          >
            <span className="text-gray-400 mt-0.5">📋</span>
            <div>
              <div className="text-white text-xs font-medium">Link einfügen</div>
              <div className="text-gray-500 text-xs">Trainer-Link manuell eingeben</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

interface InviteModalProps {
  trainerId: string;
  trainerName: string;
  onClose: () => void;
}

function InviteModal({ trainerId, trainerName, onClose }: InviteModalProps) {
  const [step, setStep] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setStep('generating');
    const code = await createTrainerInvite(trainerId, trainerName);
    if (!code) { setStep('error'); return; }
    const url = `${window.location.origin}${window.location.pathname}#invite/${code}`;
    setLink(url);
    setStep('done');
  };

  const copy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-base">Athleten einladen</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Generiere einen Link und schick ihn dem Athleten — er klickt drauf und bestätigt mit einem Tap.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg leading-none shrink-0">✕</button>
        </div>

        {step === 'idle' && (
          <button onClick={generate}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
            Link generieren
          </button>
        )}

        {step === 'generating' && (
          <div className="flex items-center justify-center gap-2 py-3 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            Wird erstellt…
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3">
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-1 truncate">{link}</span>
              <button onClick={copy}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  copied ? 'bg-green-800/60 text-green-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}>
                {copied ? '✓ Kopiert' : 'Kopieren'}
              </button>
            </div>

            <div className="flex gap-2">
              {navigator.share && (
                <button
                  onClick={() => navigator.share({ title: 'Trainer-Einladung', url: link })}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Teilen
                </button>
              )}
              <button
                onClick={() => { setStep('idle'); setLink(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors"
              >
                Neuer Link
              </button>
            </div>

            <p className="text-xs text-gray-600 text-center">Link ist 7 Tage gültig · einmalig verwendbar</p>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-3">
            <p className="text-red-400 text-xs">Fehler beim Erstellen. Ist die Supabase-Migration ausgeführt?</p>
            <button onClick={() => setStep('idle')}
              className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors">
              Erneut versuchen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending Invites ───────────────────────────────────────────────────────────

interface PendingInvitesProps {
  trainerId: string;
  onNewAthlete: (token: string, name: string) => void;
}

function PendingInvites({ trainerId, onNewAthlete }: PendingInvitesProps) {
  const [pending, setPending] = useState<{ id: string; createdAt: string; expiresAt: string }[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    // Check for newly accepted invites and pull them in
    const accepted = await listAcceptedInvites(trainerId);
    for (const inv of accepted) {
      onNewAthlete(inv.athleteToken, inv.athleteName);
      await deleteInvite(inv.id);
    }
    const pend = await listPendingInvites(trainerId);
    setPending(pend);
  }, [trainerId, onNewAthlete]);

  useEffect(() => {
    if (!CLOUD_ENABLED) return;
    refresh();
    const interval = setInterval(refresh, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [refresh]);

  const revoke = async (id: string) => {
    await deleteInvite(id);
    setPending(p => p.filter(i => i.id !== id));
  };

  if (pending.length === 0) return null;

  const fmtExpiry = (iso: string) => {
    const d = new Date(iso);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    return days <= 0 ? 'abgelaufen' : `noch ${days}d`;
  };

  return (
    <div className="border border-amber-800/30 bg-amber-950/10 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xs">⏳</span>
          <span className="text-amber-300 text-sm font-medium">{pending.length} offene Einladung{pending.length !== 1 ? 'en' : ''}</span>
          <span className="text-gray-600 text-xs">— warten auf Bestätigung</span>
        </div>
        <span className={`text-amber-700 text-xs transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="border-t border-amber-800/20">
          {pending.map(inv => (
            <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0">
              <div className="min-w-0">
                <div className="text-xs text-gray-400 font-mono truncate">{inv.id}</div>
                <div className="text-xs text-gray-600">{fmtExpiry(inv.expiresAt)}</div>
              </div>
              <button onClick={() => revoke(inv.id)}
                className="text-xs text-red-700 hover:text-red-500 transition-colors shrink-0">
                Widerrufen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kader Tab ────────────────────────────────────────────────────────────────

interface KaderTabProps {
  statuses: AthleteStatus[];
  groups: AthleteGroup[];
  selectedIds: Set<string>;
  histories: Map<string, { d: string; v: number | null }[]>;
  sortMode: SortMode;
  onToggleSelect: (id: string) => void;
  onOpenAthlete: (token: string) => void;
  onRemoveAthlete: (id: string) => void;
  onSortChange: (mode: SortMode) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function KaderTab({
  statuses, groups, selectedIds, histories, sortMode,
  onToggleSelect, onOpenAthlete, onRemoveAthlete,
  onSortChange, onSelectAll, onClearAll,
}: KaderTabProps) {
  const sorted = useMemo(() => sortStatuses(statuses, sortMode), [statuses, sortMode]);

  const selected = useMemo(() => statuses.filter(s => selectedIds.has(s.id)), [statuses, selectedIds]);
  const selHistories = useMemo(() => {
    const m = new Map<string, { d: string; v: number | null }[]>();
    for (const s of selected) { const h = histories.get(s.id); if (h) m.set(s.id, h); }
    return m;
  }, [selected, histories]);
  const selStats = useMemo(() =>
    selected.length > 1 ? computeSelectionStats(selected, selHistories) : null,
    [selected, selHistories],
  );

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'risk',      label: 'Risiko' },
    { value: 'name',      label: 'Name' },
    { value: 'acwr-desc', label: 'ACWR ↓' },
    { value: 'acwr-asc',  label: 'ACWR ↑' },
  ];

  return (
    <div className="space-y-4">
      {/* Sort + select bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap">
          {sortOptions.map(o => (
            <button key={o.value}
              onClick={() => onSortChange(o.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                sortMode === o.value
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-xs text-gray-500">
          {selectedIds.size > 0
            ? <button onClick={onClearAll} className="hover:text-gray-300">Auswahl aufheben ({selectedIds.size})</button>
            : <button onClick={onSelectAll} className="hover:text-gray-300">Alle auswählen</button>
          }
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 text-gray-600 text-sm">
          Noch keine Athleten im Kader.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map(s => (
          <AthleteCard
            key={s.id}
            status={s}
            groups={groups}
            selected={selectedIds.has(s.id)}
            onSelect={() => onToggleSelect(s.id)}
            onClick={() => onOpenAthlete(s.token)}
            onRemove={() => onRemoveAthlete(s.id)}
          />
        ))}
      </div>

      {/* Selection chart */}
      {selStats && selStats.avgHistory.length >= 3 && (
        <div className="bg-gray-900/60 border border-violet-800/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-violet-400 font-medium">Ø ACWR – Auswahl ({selected.length} Athleten)</span>
            <span className="text-xs text-gray-500">Ø {selStats.avgAcwr?.toFixed(2) ?? '—'}</span>
          </div>
          <AvgACWRChart history={selStats.avgHistory} label="Auswahl" accentColor="#818cf8" />
        </div>
      )}
    </div>
  );
}

// ── Gruppen Tab ──────────────────────────────────────────────────────────────

interface GruppenTabProps {
  groups: AthleteGroup[];
  statuses: AthleteStatus[];
  histories: Map<string, { d: string; v: number | null }[]>;
  onCreateGroup: () => void;
  onDeleteGroup: (id: string) => void;
  onAssignGroup: (athleteId: string, groupId: string, assign: boolean) => void;
  onOpenAthlete: (token: string) => void;
}

function GruppenTab({ groups, statuses, histories, onCreateGroup, onDeleteGroup, onAssignGroup, onOpenAthlete }: GruppenTabProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-gray-600 text-sm">Noch keine Gruppen erstellt.</div>
        <button onClick={onCreateGroup}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl transition-colors">
          Erste Gruppe erstellen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const c = groupColor(g.color);
        const members = statuses.filter(s => s.groupIds.includes(g.id));
        const nonMembers = statuses.filter(s => !s.groupIds.includes(g.id));
        const isExpanded = expandedGroup === g.id;

        const memberHistories = new Map<string, { d: string; v: number | null }[]>();
        for (const m of members) {
          const h = histories.get(m.id);
          if (h) memberHistories.set(m.id, h);
        }
        const stats = members.length > 0
          ? computeSelectionStats(members, memberHistories)
          : null;

        return (
          <div key={g.id} className="border border-gray-800 rounded-2xl overflow-hidden">
            {/* Group header */}
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.bg }} />
                <span className="text-white font-semibold text-sm">{g.name}</span>
                <span className="text-gray-600 text-xs">{members.length} Athleten</span>
                {stats?.avgAcwr != null && (
                  <span className="text-xs text-gray-400">· Ø ACWR {stats.avgAcwr.toFixed(2)}</span>
                )}
                {(stats?.riskCount ?? 0) > 0 && (
                  <span className="text-xs text-orange-400">· ⚠ {stats!.riskCount}</span>
                )}
              </div>
              <span className={`text-gray-500 text-xs transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-800 p-4 space-y-4">
                {/* Stats + Chart */}
                {stats && members.length > 0 && (
                  <>
                    <StatsPanel stats={stats} label={g.name} />
                    {stats.avgHistory.length >= 3 && (
                      <AvgACWRChart history={stats.avgHistory} label={g.name} accentColor={c.bg} />
                    )}
                  </>
                )}

                {/* Members */}
                {members.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Mitglieder</div>
                    <div className="space-y-1">
                      {members.map(s => (
                        <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                          <button className="flex items-center gap-2 text-left flex-1 min-w-0"
                            onClick={() => onOpenAthlete(s.token)}>
                            <span className="text-white text-sm truncate">{s.name}</span>
                            {s.acwr !== null && <ZoneBadge zone={s.zone} />}
                            {s.acwr !== null && <span className="text-gray-500 text-xs">{s.acwr.toFixed(2)}</span>}
                          </button>
                          <button
                            onClick={() => onAssignGroup(s.id, g.id, false)}
                            className="text-gray-700 hover:text-red-500 text-xs shrink-0 transition-colors"
                            title="Aus Gruppe entfernen"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add members */}
                {nonMembers.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Hinzufügen</div>
                    <div className="flex flex-wrap gap-1.5">
                      {nonMembers.map(s => (
                        <button key={s.id}
                          onClick={() => onAssignGroup(s.id, g.id, true)}
                          className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors">
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delete group */}
                <button
                  onClick={() => { if (confirm(`Gruppe "${g.name}" löschen?`)) onDeleteGroup(g.id); }}
                  className="text-xs text-red-700 hover:text-red-500 transition-colors">
                  Gruppe löschen
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Übersicht Tab ────────────────────────────────────────────────────────────

interface UebersichtTabProps {
  statuses: AthleteStatus[];
  selectedIds: Set<string>;
  histories: Map<string, { d: string; v: number | null }[]>;
  groups: AthleteGroup[];
  onOpenAthlete: (token: string) => void;
}

function UebersichtTab({ statuses, selectedIds, histories, groups, onOpenAthlete }: UebersichtTabProps) {
  const selected = statuses.filter(s => selectedIds.has(s.id));
  const hasSelection = selected.length > 0 && selected.length !== statuses.length;

  const allHistories = useMemo(() => {
    const m = new Map<string, { d: string; v: number | null }[]>();
    for (const s of statuses) { const h = histories.get(s.id); if (h) m.set(s.id, h); }
    return m;
  }, [statuses, histories]);

  const selHistories = useMemo(() => {
    const m = new Map<string, { d: string; v: number | null }[]>();
    for (const s of selected) { const h = histories.get(s.id); if (h) m.set(s.id, h); }
    return m;
  }, [selected, histories]);

  const allStats = useMemo(() => statuses.length > 0 ? computeSelectionStats(statuses, allHistories) : null, [statuses, allHistories]);
  const selStats = useMemo(() => hasSelection ? computeSelectionStats(selected, selHistories) : null, [selected, selHistories, hasSelection]);

  if (statuses.length === 0) return (
    <div className="text-center py-8 text-gray-600 text-sm">
      Füge Athleten im Kader-Tab hinzu, um Statistiken zu sehen.
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Gesamtkader ── */}
      <div className="border border-gray-800 rounded-2xl overflow-hidden">
        {/* Header with stats always visible */}
        {allStats && <StatsPanel stats={allStats} label="Gesamtkader" />}
        {/* Chart */}
        {allStats && allStats.avgHistory.length >= 3 && (
          <div className="px-4 pb-4 border-t border-gray-800/60 pt-4">
            <AvgACWRChart history={allStats.avgHistory} label="Gesamtkader" accentColor="#a78bfa" />
          </div>
        )}
        {/* Roster list */}
        <div className="border-t border-gray-800">
          <RosterList statuses={statuses} label="Alle Athleten" onOpenAthlete={onOpenAthlete} />
        </div>
      </div>

      {/* ── Auswahl (only when a subset is selected) ── */}
      {selStats && hasSelection && (
        <div className="border border-violet-800/40 rounded-2xl overflow-hidden">
          <StatsPanel stats={selStats} label={`Auswahl (${selected.length})`} />
          {selStats.avgHistory.length >= 3 && (
            <div className="px-4 pb-4 border-t border-gray-800/60 pt-4">
              <AvgACWRChart history={selStats.avgHistory} label="Auswahl" accentColor="#818cf8" />
            </div>
          )}
          <div className="border-t border-gray-800">
            <RosterList statuses={selected} label="Ausgewählte Athleten" onOpenAthlete={onOpenAthlete} />
          </div>
        </div>
      )}

      {/* ── Gruppen ── */}
      {groups.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide px-1">Gruppen</div>
          {groups.map(g => {
            const members = statuses.filter(s => s.groupIds.includes(g.id));
            if (members.length === 0) return null;
            const gHistories = new Map<string, { d: string; v: number | null }[]>();
            for (const m of members) { const h = histories.get(m.id); if (h) gHistories.set(m.id, h); }
            const stats = computeSelectionStats(members, gHistories);
            const c = groupColor(g.color);
            return (
              <div key={g.id} className="border border-gray-800 rounded-2xl overflow-hidden">
                <StatsPanel stats={stats} label={g.name} />
                {stats.avgHistory.length >= 3 && (
                  <div className="px-4 pb-4 border-t border-gray-800/60 pt-4">
                    <AvgACWRChart history={stats.avgHistory} label={g.name} accentColor={c.bg} />
                  </div>
                )}
                <div className="border-t border-gray-800">
                  <RosterList statuses={members} label={`${g.name} – Athleten`} accentColor={c.bg} onOpenAthlete={onOpenAthlete} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main TrainerDashboard ────────────────────────────────────────────────────

type Tab = 'kader' | 'gruppen' | 'uebersicht';

// ── Mock data for debugging ───────────────────────────────────────────────────

const MOCK_NAMES = [
  'Leon Weber', 'Felix Müller', 'Jonas Bauer', 'Lukas Hoffmann', 'Noah Fischer',
  'Elias Schmidt', 'Finn Richter', 'Ben Schulz', 'Luca Wagner', 'Tim Koch', 'Max Braun',
];

/** Generates a 60-day ACWR history that ends at `targetAcwr` on today */
function generateMockHistory(seed: number, targetAcwr: number | null): { d: string; v: number | null }[] {
  const result: { d: string; v: number | null }[] = [];

  // Build raw walk (60 days, oldest first)
  const raw: number[] = [];
  let v = 0.85 + (seed % 7) * 0.06;
  for (let i = 59; i >= 0; i--) {
    v += Math.sin(i * 0.4 + seed) * 0.06;
    v = Math.max(0.5, Math.min(1.8, v));
    raw.push(v);
  }

  // Steer final value towards targetAcwr over last 7 days
  if (targetAcwr !== null) {
    const drift = (targetAcwr - raw[raw.length - 1]) / 7;
    for (let k = raw.length - 7; k < raw.length; k++) {
      raw[k] = Math.max(0.5, Math.min(1.9, raw[k] + drift * (k - (raw.length - 8))));
    }
    raw[raw.length - 1] = targetAcwr; // pin last point exactly
  }

  for (let i = 0; i < 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - (59 - i));
    const iso = d.toISOString().split('T')[0];
    // First 28 days: no valid ACWR yet (building chronic window)
    result.push({ d: iso, v: i >= 28 ? Math.round(raw[i] * 100) / 100 : null });
  }
  return result;
}

function buildMockRoster(): {
  athletes: ManagedAthlete[];
  groups: AthleteGroup[];
  statuses: Map<string, AthleteStatus>;
  histories: Map<string, { d: string; v: number | null }[]>;
} {
  const group1: AthleteGroup = { id: 'g1', name: 'Starters', color: 'violet' };
  const group2: AthleteGroup = { id: 'g2', name: 'Bench', color: 'sky' };

  const athletes: ManagedAthlete[] = MOCK_NAMES.map((name, i) => ({
    id:       `mock_${i}`,
    name,
    sport:    'Basketball',
    token:    `mock_token_${i}`,
    groupIds: i < 5 ? ['g1'] : ['g2'],
    addedAt:  new Date().toISOString().split('T')[0],
  }));

  // Target ACWR for today — determines both the card value AND the last history point
  const targetAcwrs: (number | null)[] = [1.05, 0.92, 1.38, 1.62, 0.65, 1.10, null, 0.88, 1.41, 1.15, 0.72];

  const statuses = new Map<string, AthleteStatus>();
  const histories = new Map<string, { d: string; v: number | null }[]>();

  athletes.forEach((a, i) => {
    const target = targetAcwrs[i];
    const hist = generateMockHistory(i * 7, target);
    histories.set(a.id, hist);

    // Derive zone from actual target value (same logic as classifyZone)
    const zone: ACWRZone = target === null ? 'building'
      : target >= 0.8 && target <= 1.3 ? 'optimal'
      : target < 0.8 ? 'low'
      : target <= 1.5 ? 'elevated'
      : 'high';

    // Trend: compare today to 7 days ago in the history
    const validPts = hist.filter(p => p.v !== null);
    const todayVal = validPts[validPts.length - 1]?.v ?? null;
    const weekAgoVal = validPts[validPts.length - 8]?.v ?? null;
    const trend = todayVal !== null && weekAgoVal !== null
      ? Math.round((todayVal - weekAgoVal) * 100) / 100
      : null;

    statuses.set(a.id, {
      id: a.id, name: a.name, sport: a.sport, token: a.token, groupIds: a.groupIds,
      acwr: target,
      acuteLoad:   Math.round(target !== null ? target * (280 + i * 10) : 0),
      chronicLoad: Math.round(280 + i * 10),
      zone, trend,
      lastLoadDate: new Date().toISOString().split('T')[0],
      dataAge: i % 3, loading: false, error: false,
    });
  });

  return { athletes, groups: [group1, group2], statuses, histories };
}

// ── Main TrainerDashboard ─────────────────────────────────────────────────────

interface TrainerDashboardProps {
  user: User;
  trainerName: string;
}

export function TrainerDashboard({ user, trainerName }: TrainerDashboardProps) {
  const [roster, setRoster] = useState(() => loadRoster());
  const [statuses, setStatuses] = useState<Map<string, AthleteStatus>>(new Map());
  const [histories, setHistories] = useState<Map<string, { d: string; v: number | null }[]>>(new Map());

  const [tab, setTab] = useState<Tab>('kader');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [openAthleteToken, setOpenAthleteToken] = useState<string | null>(null);
  const [isMockLoaded, setIsMockLoaded] = useState(false);
  const mockRef = useRef(false);

  // Persist roster (skip when mock data is active)
  useEffect(() => { if (!isMockLoaded) saveRoster(roster); }, [roster, isMockLoaded]);

  const loadMockData = useCallback(() => {
    if (mockRef.current) {
      // Toggle off — restore real roster
      mockRef.current = false;
      setIsMockLoaded(false);
      const real = loadRoster();
      setRoster(real);
      setStatuses(new Map());
      setHistories(new Map());
      return;
    }
    mockRef.current = true;
    setIsMockLoaded(true);
    const { athletes, groups, statuses: mockStatuses, histories: mockHistories } = buildMockRoster();
    setRoster({ athletes, groups });
    setStatuses(mockStatuses);
    setHistories(mockHistories);
  }, []);

  // Load athlete data
  const refreshAthlete = useCallback(async (athlete: ManagedAthlete) => {
    // Mark loading
    setStatuses(prev => {
      const next = new Map(prev);
      next.set(athlete.id, { id: athlete.id, name: athlete.name, sport: athlete.sport,
        token: athlete.token, groupIds: athlete.groupIds,
        acwr: null, acuteLoad: 0, chronicLoad: 0, zone: 'nodata',
        trend: null, lastLoadDate: null, dataAge: 0, loading: true, error: false });
      return next;
    });

    const data = await fetchLiveTrainerData(athlete.token);

    setStatuses(prev => {
      const next = new Map(prev);
      if (!data) {
        next.set(athlete.id, { id: athlete.id, name: athlete.name, sport: athlete.sport,
          token: athlete.token, groupIds: athlete.groupIds,
          acwr: null, acuteLoad: 0, chronicLoad: 0, zone: 'nodata',
          trend: null, lastLoadDate: null, dataAge: 0, loading: false, error: true });
      } else {
        next.set(athlete.id, computeAthleteStatus(athlete, data));
      }
      return next;
    });

    if (data) {
      setHistories(prev => {
        const next = new Map(prev);
        next.set(athlete.id, data.acwrHistory ?? []);
        return next;
      });
    }
  }, []);

  // Load all athletes on mount + when roster changes
  useEffect(() => {
    for (const a of roster.athletes) {
      if (!statuses.has(a.id)) refreshAthlete(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.athletes]);

  const statusList = useMemo(() =>
    roster.athletes.map(a => statuses.get(a.id) ?? {
      id: a.id, name: a.name, sport: a.sport, token: a.token, groupIds: a.groupIds,
      acwr: null, acuteLoad: 0, chronicLoad: 0, zone: 'nodata' as ACWRZone,
      trend: null, lastLoadDate: null, dataAge: 0, loading: true, error: false,
    }),
    [roster.athletes, statuses],
  );

  const alerts = useMemo(() => generateAlerts(statusList), [statusList]);

  // Roster mutations
  const addAthlete = (athlete: ManagedAthlete) => {
    setRoster(r => ({ ...r, athletes: [...r.athletes, athlete] }));
    setShowAddModal(false);
    refreshAthlete(athlete);
  };

  const removeAthlete = (id: string) => {
    setRoster(r => ({ ...r, athletes: r.athletes.filter(a => a.id !== id) }));
    setStatuses(prev => { const next = new Map(prev); next.delete(id); return next; });
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const addGroup = (group: AthleteGroup) => {
    setRoster(r => ({ ...r, groups: [...r.groups, group] }));
    setShowGroupModal(false);
  };

  const deleteGroup = (id: string) => {
    setRoster(r => ({
      groups: r.groups.filter(g => g.id !== id),
      athletes: r.athletes.map(a => ({ ...a, groupIds: a.groupIds.filter(g => g !== id) })),
    }));
  };

  const assignGroup = (athleteId: string, groupId: string, assign: boolean) => {
    setRoster(r => ({
      ...r,
      athletes: r.athletes.map(a => a.id !== athleteId ? a : {
        ...a,
        groupIds: assign
          ? [...new Set([...a.groupIds, groupId])]
          : a.groupIds.filter(g => g !== groupId),
      }),
    }));
    setStatuses(prev => {
      const cur = prev.get(athleteId);
      if (!cur) return prev;
      const next = new Map(prev);
      next.set(athleteId, {
        ...cur,
        groupIds: assign
          ? [...new Set([...cur.groupIds, groupId])]
          : cur.groupIds.filter(g => g !== groupId),
      });
      return next;
    });
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // If viewing a specific athlete
  if (openAthleteToken) {
    return (
      <div className="relative">
        <button
          onClick={() => { setOpenAthleteToken(null); }}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/90 border border-gray-700 rounded-xl text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors backdrop-blur-sm"
        >
          ← Zurück
        </button>
        <TrainerView token={openAthleteToken} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'kader',      label: 'Kader' },
    { key: 'gruppen',    label: 'Gruppen' },
    { key: 'uebersicht', label: 'Übersicht' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => { window.location.hash = ''; dispatchEvent(new HashChangeEvent('hashchange')); }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-1"
            >
              ← App
            </button>
            <h1 className="text-xl font-bold text-white">Trainer-Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">{roster.athletes.length} Athleten · {roster.groups.length} Gruppen</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowGroupModal(true)}
              className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 rounded-xl hover:border-gray-500 hover:text-gray-200 transition-colors">
              + Gruppe
            </button>
            <AddAthleteDropdown
              cloudEnabled={CLOUD_ENABLED}
              onInvite={() => setShowInviteModal(true)}
              onManual={() => setShowAddModal(true)}
            />
            <button onClick={() => { for (const a of roster.athletes) refreshAthlete(a); }}
              className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 rounded-xl hover:border-gray-500 hover:text-gray-200 transition-colors"
              title="Alle Daten aktualisieren">
              ↻
            </button>
            <button onClick={loadMockData}
              className={`px-3 py-1.5 text-xs rounded-xl border transition-colors ${
                isMockLoaded
                  ? 'border-amber-600 text-amber-400 bg-amber-950/30 hover:bg-amber-950/50'
                  : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
              title="Demo-Daten laden (Basketball-Team)">
              {isMockLoaded ? 'Demo aus' : 'Demo'}
            </button>
          </div>
        </div>

        {/* Pending invites (polls every 15s, auto-imports accepted) */}
        {CLOUD_ENABLED && !isMockLoaded && (
          <PendingInvites
            trainerId={user.id}
            onNewAthlete={async (token, name) => {
              // Check not already in roster
              if (roster.athletes.some(a => a.token === token)) return;
              const data = await fetchLiveTrainerData(token);
              const athlete: ManagedAthlete = {
                id:       crypto.randomUUID(),
                name:     data?.athleteName || name,
                sport:    data?.sport || '',
                token,
                groupIds: [],
                addedAt:  new Date().toISOString().split('T')[0],
              };
              setRoster(r => ({ ...r, athletes: [...r.athletes, athlete] }));
              refreshAthlete(athlete);
            }}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-2xl p-1">
          {tabs.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm rounded-xl transition-colors font-medium ${
                tab === t.key
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'kader' && (
          <KaderTab
            statuses={statusList}
            groups={roster.groups}
            selectedIds={selectedIds}
            histories={histories}
            sortMode={sortMode}
            onToggleSelect={toggleSelect}
            onOpenAthlete={setOpenAthleteToken}
            onRemoveAthlete={removeAthlete}
            onSortChange={setSortMode}
            onSelectAll={() => setSelectedIds(new Set(roster.athletes.map(a => a.id)))}
            onClearAll={() => setSelectedIds(new Set())}
          />
        )}
        {tab === 'gruppen' && (
          <GruppenTab
            groups={roster.groups}
            statuses={statusList}
            histories={histories}
            onCreateGroup={() => setShowGroupModal(true)}
            onDeleteGroup={deleteGroup}
            onAssignGroup={assignGroup}
            onOpenAthlete={setOpenAthleteToken}
          />
        )}
        {tab === 'uebersicht' && (
          <UebersichtTab
            statuses={statusList}
            selectedIds={selectedIds}
            histories={histories}
            groups={roster.groups}
            onOpenAthlete={setOpenAthleteToken}
          />
        )}
      </div>

      {/* Fixed alert panel (bottom) */}
      <AlertPanel alerts={alerts} />

      {showInviteModal && (
        <InviteModal
          trainerId={user.id}
          trainerName={trainerName}
          onClose={() => setShowInviteModal(false)}
        />
      )}
      {showAddModal && (
        <AddAthleteModal
          groups={roster.groups}
          onAdd={addAthlete}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showGroupModal && (
        <CreateGroupModal
          onAdd={addGroup}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </div>
  );
}
