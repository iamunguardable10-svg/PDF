import { useState, useEffect } from 'react';
import { Building2, Users, ArrowRight, Check, Loader2 } from 'lucide-react';
import { createOrganization, createDepartment, hasOrganization } from '../../lib/organizationStorage';
import { createTeam } from '../../lib/attendanceStorage';

const SPORTS = ['Fußball', 'Basketball', 'Volleyball', 'Handball', 'Tennis', 'Leichtathletik', 'Schwimmen', 'Turnen', 'Sonstiges'];
const TEAM_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

interface Props {
  userId: string;
  onDone: () => void;
  onSkip: () => void;
}

type Step = 'org' | 'dept' | 'team' | 'done';

export function CoachSetupWizard({ userId, onDone, onSkip }: Props) {
  const [step,    setStep]    = useState<Step>('org');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Skip wizard if user already owns an org
  useEffect(() => {
    hasOrganization(userId).then(exists => { if (exists) onSkip(); });
  }, [userId, onSkip]);

  // Step 1 — Org
  const [orgName,   setOrgName]   = useState('');
  const [orgSport,  setOrgSport]  = useState('');
  const [orgId,     setOrgId]     = useState<string | null>(null);

  // Step 2 — Dept (optional)
  const [deptName,  setDeptName]  = useState('');
  const [deptId,    setDeptId]    = useState<string | null>(null);

  // Step 3 — Team
  const [teamName,  setTeamName]  = useState('');
  const [teamSport, setTeamSport] = useState('');
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0]);

  // ── Step handlers ──────────────────────────────────────────────────────────

  async function handleCreateOrg() {
    if (!orgName.trim()) return;
    setSaving(true); setError(null);
    const result = await createOrganization(userId, orgName.trim(), orgSport || undefined);
    setSaving(false);
    if (!result) { setError('Keine Verbindung zur Datenbank.'); return; }
    if ('error' in result) { setError(`Fehler: ${result.error}`); return; }
    setOrgId(result.org.id);
    setStep('dept');
  }

  async function handleCreateDept() {
    if (!orgId) return;
    setSaving(true); setError(null);
    if (deptName.trim()) {
      const dept = await createDepartment(orgId, deptName.trim(), orgSport || undefined);
      if (dept) setDeptId(dept.id);
    }
    setSaving(false);
    setStep('team');
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setSaving(true); setError(null);
    const team = await createTeam(userId, teamName.trim(), teamSport || orgSport || 'Sonstiges', teamColor);
    // Link team to org/dept if created
    if (team && orgId) {
      const { supabase } = await import('../../lib/supabase');
      await supabase.from('att_teams').update({
        organization_id: orgId,
        ...(deptId ? { department_id: deptId } : {}),
      }).eq('id', team.id);
    }
    setSaving(false);
    if (!team) { setError('Team konnte nicht erstellt werden.'); return; }
    setStep('done');
    onDone();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const STEPS: { id: Step; label: string }[] = [
    { id: 'org',  label: 'Verein' },
    { id: 'dept', label: 'Abteilung' },
    { id: 'team', label: 'Team' },
  ];
  const stepIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-violet-900/40">
          🏟
        </div>
        <span className="text-xl font-bold tracking-tight">Club OS</span>
      </div>

      <div className="w-full max-w-sm space-y-6">

        {/* Progress indicator */}
        {step !== 'done' && (
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
                  i < stepIdx ? 'bg-violet-600 text-white' :
                  i === stepIdx ? 'bg-violet-500 text-white ring-2 ring-violet-400/30' :
                  'bg-gray-800 text-gray-600'
                }`}>
                  {i < stepIdx ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === stepIdx ? 'text-white' : 'text-gray-600'}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < stepIdx ? 'bg-violet-600' : 'bg-gray-800'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Step 1: Verein ── */}
        {step === 'org' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Verein anlegen</h1>
              <p className="text-sm text-gray-500">Gib deinem Verein oder deiner Organisation einen Namen.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Vereinsname *</label>
                <input
                  autoFocus
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateOrg()}
                  placeholder="z.B. TSV Musterhausen"
                  className="w-full h-11 px-3.5 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hauptsportart</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPORTS.map(s => (
                    <button key={s} onClick={() => setOrgSport(s === orgSport ? '' : s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        orgSport === s ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreateOrg}
                disabled={saving || !orgName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={15} /> Weiter</>}
              </button>
              <button onClick={onSkip}
                className="px-4 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
                Überspringen
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Abteilung ── */}
        {step === 'dept' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Building2 size={20} className="text-violet-400" /> Abteilung
              </h1>
              <p className="text-sm text-gray-500">Optional: Leg eine Abteilung an (z.B. "Herren" oder "Jugend").</p>
            </div>
            <input
              autoFocus
              value={deptName}
              onChange={e => setDeptName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateDept()}
              placeholder="z.B. Fußball Herren (optional)"
              className="w-full h-11 px-3.5 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreateDept}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={15} /> {deptName.trim() ? 'Anlegen & weiter' : 'Überspringen'}</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Team ── */}
        {step === 'team' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users size={20} className="text-violet-400" /> Erstes Team
              </h1>
              <p className="text-sm text-gray-500">Erstelle dein erstes Team. Weitere kannst du später hinzufügen.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Teamname *</label>
                <input
                  autoFocus
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                  placeholder="z.B. 1. Mannschaft"
                  className="w-full h-11 px-3.5 rounded-2xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sportart</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPORTS.map(s => (
                    <button key={s} onClick={() => setTeamSport(s === teamSport ? '' : s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        teamSport === s ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Teamfarbe</label>
                <div className="flex gap-2">
                  {TEAM_COLORS.map(c => (
                    <button key={c} onClick={() => setTeamColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${teamColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0b0f] scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreateTeam}
                disabled={saving || !teamName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={15} /> Fertig</>}
              </button>
              <button onClick={onSkip}
                className="px-4 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
                Überspringen
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
