import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ManagedAthlete, AthleteGroup, AthleteStatus, ACWRZone, SelectionStats } from '../types/trainerDashboard';
import {
  loadRoster, saveRoster, extractToken,
  computeAthleteStatus, computeSelectionStats,
  generateAlerts, sortStatuses, groupColor, GROUP_COLORS,
  type SortMode, type CoachAlert,
} from '../lib/trainerRoster';
import { fetchLiveTrainerData } from '../lib/trainerShare';
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

// ── Alert Bar ────────────────────────────────────────────────────────────────

function AlertBar({ alerts }: { alerts: CoachAlert[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || alerts.length === 0) return null;

  const critical = alerts.filter(a => a.level === 'critical');
  const warnings = alerts.filter(a => a.level === 'warning');

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm space-y-1.5 relative ${
      critical.length > 0
        ? 'bg-red-950/30 border-red-800/40'
        : 'bg-orange-950/30 border-orange-800/40'
    }`}>
      <button onClick={() => setDismissed(true)}
        className="absolute top-2 right-3 text-gray-600 hover:text-gray-400 text-xs">✕</button>

      {critical.slice(0, 2).map((a, i) => (
        <div key={i} className="flex gap-2 items-start text-xs">
          <span className="text-red-400 shrink-0">🔴</span>
          <span className="text-red-300"><strong>{a.athleteName}:</strong> {a.message}</span>
        </div>
      ))}
      {warnings.slice(0, 2).map((a, i) => (
        <div key={i} className="flex gap-2 items-start text-xs">
          <span className="text-orange-400 shrink-0">⚠</span>
          <span className="text-orange-300"><strong>{a.athleteName}:</strong> {a.message}</span>
        </div>
      ))}
      {alerts.length > 4 && (
        <div className="text-xs text-gray-500">+{alerts.length - 4} weitere Hinweise</div>
      )}
    </div>
  );
}

// ── Kader Tab ────────────────────────────────────────────────────────────────

interface KaderTabProps {
  statuses: AthleteStatus[];
  groups: AthleteGroup[];
  selectedIds: Set<string>;
  sortMode: SortMode;
  onToggleSelect: (id: string) => void;
  onOpenAthlete: (token: string) => void;
  onRemoveAthlete: (id: string) => void;
  onSortChange: (mode: SortMode) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function KaderTab({
  statuses, groups, selectedIds, sortMode,
  onToggleSelect, onOpenAthlete, onRemoveAthlete,
  onSortChange, onSelectAll, onClearAll,
}: KaderTabProps) {
  const sorted = useMemo(() => sortStatuses(statuses, sortMode), [statuses, sortMode]);

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
                {/* Stats */}
                {stats && members.length > 0 && (
                  <StatsPanel stats={stats} label={g.name} />
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
}

function UebersichtTab({ statuses, selectedIds, histories, groups }: UebersichtTabProps) {
  const selected = statuses.filter(s => selectedIds.has(s.id));
  const selHistories = new Map<string, { d: string; v: number | null }[]>();
  for (const s of selected) {
    const h = histories.get(s.id);
    if (h) selHistories.set(s.id, h);
  }

  const allHistories = new Map<string, { d: string; v: number | null }[]>();
  for (const s of statuses) {
    const h = histories.get(s.id);
    if (h) allHistories.set(s.id, h);
  }

  const allStats = statuses.length > 0 ? computeSelectionStats(statuses, allHistories) : null;
  const selStats = selected.length > 0 ? computeSelectionStats(selected, selHistories) : null;

  return (
    <div className="space-y-5">
      {allStats && <StatsPanel stats={allStats} label="Gesamtkader" />}

      {selStats && selected.length !== statuses.length && (
        <StatsPanel stats={selStats} label="Auswahl" />
      )}

      {/* Group overview */}
      {groups.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Gruppen</div>
          {groups.map(g => {
            const members = statuses.filter(s => s.groupIds.includes(g.id));
            if (members.length === 0) return null;
            const gHistories = new Map<string, { d: string; v: number | null }[]>();
            for (const m of members) {
              const h = histories.get(m.id);
              if (h) gHistories.set(m.id, h);
            }
            const stats = computeSelectionStats(members, gHistories);
            const c = groupColor(g.color);
            return (
              <div key={g.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.bg }} />
                  <span className="text-white text-sm font-semibold">{g.name}</span>
                  <span className="text-gray-500 text-xs">{members.length} Athleten</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-500">Ø ACWR</div>
                    <div className="text-base font-bold text-white">{stats.avgAcwr?.toFixed(2) ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Ø Akut</div>
                    <div className="text-base font-bold text-sky-400">{stats.avgAcute}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Risiko</div>
                    <div className={`text-base font-bold ${stats.riskCount > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {stats.riskCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {statuses.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-sm">
          Füge Athleten im Kader-Tab hinzu, um Statistiken zu sehen.
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

function generateMockHistory(seed: number): { d: string; v: number | null }[] {
  const result: { d: string; v: number | null }[] = [];
  let acwr = 0.9 + (seed % 5) * 0.08;
  for (let i = 59; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    // Random walk with some variation per player
    acwr += (Math.sin(i * 0.3 + seed) * 0.07);
    acwr = Math.max(0.5, Math.min(1.8, acwr));
    result.push({ d: iso, v: i < 28 ? Math.round(acwr * 100) / 100 : null });
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

  const zones: ACWRZone[] = ['optimal', 'optimal', 'elevated', 'high', 'low', 'optimal', 'building', 'optimal', 'elevated', 'optimal', 'low'];
  const acwrValues = [1.05, 0.92, 1.38, 1.62, 0.65, 1.10, null, 0.88, 1.41, 1.15, 0.72];

  const statuses = new Map<string, AthleteStatus>();
  const histories = new Map<string, { d: string; v: number | null }[]>();

  athletes.forEach((a, i) => {
    const hist = generateMockHistory(i * 7);
    histories.set(a.id, hist);
    statuses.set(a.id, {
      id: a.id, name: a.name, sport: a.sport, token: a.token, groupIds: a.groupIds,
      acwr: acwrValues[i], acuteLoad: Math.round(300 + i * 40), chronicLoad: Math.round(280 + i * 35),
      zone: zones[i], trend: (i % 3 === 0 ? 0.12 : i % 3 === 1 ? -0.08 : 0.02),
      lastLoadDate: new Date().toISOString().split('T')[0],
      dataAge: i % 3, loading: false, error: false,
    });
  });

  return { athletes, groups: [group1, group2], statuses, histories };
}

// ── Main TrainerDashboard ─────────────────────────────────────────────────────

export function TrainerDashboard() {
  const [roster, setRoster] = useState(() => loadRoster());
  const [statuses, setStatuses] = useState<Map<string, AthleteStatus>>(new Map());
  const [histories, setHistories] = useState<Map<string, { d: string; v: number | null }[]>>(new Map());

  const [tab, setTab] = useState<Tab>('kader');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
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
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

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
            <button onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium">
              + Athlet
            </button>
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

        {/* Alerts */}
        <AlertBar alerts={alerts} />

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
          />
        )}
      </div>

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
