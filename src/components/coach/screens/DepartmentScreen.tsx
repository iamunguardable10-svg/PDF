import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import { CalendarView } from '../../calendar/CalendarView';
import { SessionDetail } from '../../attendance/SessionDetail';
import { SessionPlanner } from '../../attendance/SessionPlanner';
import { loadDeptSessionsAsEvents } from '../../../lib/calendarLoaders';
import { loadSessionsByDepartment } from '../../../lib/attendanceStorage';
import type { CalEvent } from '../../../types/calEvent';
import type { AttendanceSession } from '../../../types/attendance';
import type { DepartmentCalendarSession, Department } from '../../../types/organization';
import type { CoachOutletContext } from '../CoachShell';

function loadWindow() {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  const from = d.toISOString().split('T')[0];
  const to   = new Date(d.getTime() + 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { from, to };
}

export function DepartmentScreen() {
  const {
    user, departments, teams, roster, groups,
    coachContext, loading: ctxLoading,
    reload, onCreateDepartment, onDeleteDepartment,
  } = useOutletContext<CoachOutletContext>();

  const isAdmin = !coachContext || coachContext.role === 'org_admin';

  const visibleDepts = isAdmin
    ? departments
    : departments.filter(d => coachContext?.deptIds.includes(d.id));

  // ── List view state ───────────────────────────────────────────────────────

  const [showForm,   setShowForm]   = useState(false);
  const [newName,    setNewName]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  // ── Calendar drill-down state ─────────────────────────────────────────────

  const [selectedDept,  setSelectedDept]  = useState<Department | null>(null);
  const [filterTeamId,  setFilterTeamId]  = useState<string>('');
  const [events,        setEvents]        = useState<CalEvent[]>([]);
  const [rawSessions,   setRawSessions]   = useState<DepartmentCalendarSession[]>([]);
  const [calLoading,    setCalLoading]    = useState(false);
  const [openSession,   setOpenSession]   = useState<DepartmentCalendarSession | null>(null);
  const [showPlanner,   setShowPlanner]   = useState(false);
  const [planDatum,     setPlanDatum]     = useState<string | undefined>();
  const [planTime,      setPlanTime]      = useState<string | undefined>();

  const deptTeams  = selectedDept ? teams.filter(t => t.departmentId === selectedDept.id) : [];
  const teamNameMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const loadCalendar = useCallback(async () => {
    if (!selectedDept) return;
    setCalLoading(true);
    const { from, to } = loadWindow();
    const [evs, raw] = await Promise.all([
      loadDeptSessionsAsEvents(selectedDept.id, teamNameMap, from, to),
      loadSessionsByDepartment(selectedDept.id, from, to),
    ]);
    setEvents(evs);
    setRawSessions(raw);
    setCalLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    await onCreateDepartment(name);
    setSaving(false);
    setNewName(''); setShowForm(false);
  }

  async function handleDelete(deptId: string) {
    setDeleting(deptId);
    await onDeleteDepartment(deptId);
    setDeleting(null); setConfirmDel(null);
    if (selectedDept?.id === deptId) setSelectedDept(null);
  }

  function handleAddEvent(datum: string, time: string) {
    setPlanDatum(datum); setPlanTime(time); setShowPlanner(true);
  }

  // ── Derived: filtered events ──────────────────────────────────────────────

  const visibleEvents = filterTeamId
    ? events.filter(e => e.teamId === filterTeamId)
    : events;

  // ── Dept detail view ──────────────────────────────────────────────────────

  if (selectedDept) {
    return (
      <div className="space-y-4">

        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedDept(null); setFilterTeamId(''); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={14} /> Abteilungen
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{selectedDept.name}</h2>
            {selectedDept.sport && <p className="text-xs text-gray-500">{selectedDept.sport}</p>}
          </div>
          <button
            onClick={() => handleAddEvent(new Date().toISOString().split('T')[0], '10:00')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Einheit
          </button>
        </div>

        {/* Team filter chips */}
        {deptTeams.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterTeamId('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                !filterTeamId
                  ? 'bg-gray-700 border-gray-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              Alle Teams
            </button>
            {deptTeams.map(t => (
              <button
                key={t.id}
                onClick={() => setFilterTeamId(t.id === filterTeamId ? '' : t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                  filterTeamId === t.id
                    ? 'bg-gray-700 border-gray-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Calendar */}
        <CalendarView
          events={visibleEvents}
          loading={calLoading}
          onEventClick={ev => {
            const raw = rawSessions.find(s => s.id === ev.sourceId);
            if (raw) setOpenSession(raw);
          }}
          onAddEvent={handleAddEvent}
        />

        {/* Modals */}
        {openSession && (
          <SessionDetail
            session={openSession as unknown as AttendanceSession}
            trainerId={user.id}
            onClose={() => setOpenSession(null)}
            onDeleted={() => { setOpenSession(null); loadCalendar(); reload(); }}
          />
        )}
        {showPlanner && (
          <SessionPlanner
            trainerId={user.id}
            teams={deptTeams.length > 0 ? deptTeams : teams}
            membersByTeam={{}}
            roster={roster}
            groups={groups}
            prefillDatum={planDatum}
            prefillTime={planTime}
            onCreated={() => { setShowPlanner(false); loadCalendar(); reload(); }}
            onClose={() => setShowPlanner(false)}
          />
        )}
      </div>
    );
  }

  // ── Department list view ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Abteilungen</h2>
          <p className="text-xs text-gray-500 mt-0.5">{visibleDepts.length} Abteilungen</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/50 text-violet-300 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Neue Abteilung
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false); }}
            placeholder="Name der Abteilung"
            className="flex-1 h-9 px-3 rounded-xl bg-gray-900 border border-violet-700 text-sm text-white placeholder-gray-600 focus:outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center gap-1"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button onClick={() => { setShowForm(false); setNewName(''); }}
            className="h-9 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Dept list — same card style as Teams */}
      {ctxLoading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-gray-600">
          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Wird geladen…
        </div>
      ) : visibleDepts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl space-y-2">
          <p className="text-gray-500 text-sm">Noch keine Abteilungen</p>
          {isAdmin && <p className="text-gray-600 text-xs">Klick auf "Neue Abteilung" um zu starten</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleDepts.map(dept => {
            const dt           = teams.filter(t => t.departmentId === dept.id);
            const isConfirming = confirmDel === dept.id;

            return (
              <div
                key={dept.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-violet-700/40 transition-all group"
              >
                <button
                  onClick={() => setSelectedDept(dept)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/30 border border-emerald-800/40 flex items-center justify-center text-base flex-shrink-0">
                    🏛
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-violet-200 truncate">{dept.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {dt.length} {dt.length === 1 ? 'Team' : 'Teams'}
                      {dept.sport && ` · ${dept.sport}`}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-gray-600 group-hover:text-violet-400 flex-shrink-0" />
                </button>

                {/* Delete — admin only */}
                {isAdmin && (
                  isConfirming ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDelete(dept.id)}
                        disabled={deleting === dept.id}
                        className="text-[11px] px-2 py-1 rounded-lg bg-red-900/50 hover:bg-red-800/60 text-red-300 transition-colors"
                      >
                        {deleting === dept.id ? <Loader2 size={11} className="animate-spin" /> : 'Löschen'}
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="text-[11px] px-2 py-1 rounded-lg bg-gray-700 text-gray-400 transition-colors">
                        Abbruch
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDel(dept.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
