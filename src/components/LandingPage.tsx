interface Props {
  onStart: () => void;
  onGuest: () => void;
}

type Feature = {
  title: string;
  text: string;
  eyebrow: string;
};

type WorkflowStep = {
  step: string;
  title: string;
  text: string;
};

type BuyerSignal = {
  title: string;
  text: string;
};

type Plan = {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const FEATURES: Feature[] = [
  {
    eyebrow: 'Planning',
    title: 'Sessions, calendar and coach ownership',
    text: 'Plan team sessions, keep the calendar clean and make it obvious which coach owns which training block.',
  },
  {
    eyebrow: 'Availability',
    title: 'Expected by default, exceptions only',
    text: 'Players only act when they are late, unsure or out. Late includes minutes; maybe and no require a reason.',
  },
  {
    eyebrow: 'Attendance',
    title: 'Coach-final attendance layer',
    text: 'Separate athlete intent from authoritative coach status: present, late, partial, excused or unexcused.',
  },
  {
    eyebrow: 'Load',
    title: 'ACWR and workload monitoring',
    text: 'Move beyond attendance and connect training participation to load, risk flags and athlete readiness.',
  },
];

const WORKFLOW: WorkflowStep[] = [
  {
    step: '01',
    title: 'Coach plans the week',
    text: 'Sessions are assigned to teams, coaches and dates so everyone knows what is coming next.',
  },
  {
    step: '02',
    title: 'Athletes report exceptions',
    text: 'No reply means expected. Late, maybe and no become structured information instead of chat noise.',
  },
  {
    step: '03',
    title: 'Coach operates attendance',
    text: 'Exceptions and final statuses sit in one operational board, ready for matchday or practice.',
  },
];

const BUYER_SIGNALS: BuyerSignal[] = [
  {
    title: 'For head coaches',
    text: 'Stop chasing replies before every practice and know the expected roster before you arrive at the gym.',
  },
  {
    title: 'For academy coordinators',
    text: 'Create one shared operating view across teams, coaches and player groups without another spreadsheet layer.',
  },
  {
    title: 'For performance staff',
    text: 'Connect attendance, partial participation and workload so missed or modified sessions are not invisible.',
  },
];

const PLANS: Plan[] = [
  {
    name: 'Demo',
    price: 'Free',
    description: 'Try the workflow locally before inviting a team.',
    features: ['Sample club data', 'Coach and athlete flows', 'Local demo mode'],
  },
  {
    name: 'Team',
    price: '9-29 EUR / month',
    description: 'For one serious team that needs shared availability and attendance.',
    features: ['Cloud sync', 'Team sessions', 'Availability exceptions', 'Coach-final attendance'],
    highlighted: true,
  },
  {
    name: 'Club',
    price: 'Custom',
    description: 'For multi-team academies and clubs with staff permissions.',
    features: ['Departments', 'Multi-coach roles', 'Exports and reports', 'Load analytics'],
  },
];

const FINAL_STATES = ['Present', 'Late', 'Partial', 'Excused', 'Unexcused'];
const REEL_STEPS = ['Plan session', 'Collect exceptions', 'Finalize attendance', 'Read load'];
const LOAD_POINTS = [34, 52, 46, 72, 64, 88, 58, 76, 62, 94];

export function LandingPage({ onStart, onGuest }: Props) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05060a] text-white">
      <style>{`
        @keyframes tl-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(-5deg); }
          50% { transform: translate3d(0, -14px, 0) rotateX(2deg) rotateY(5deg); }
        }
        @keyframes tl-scan {
          0% { transform: translateX(-110%); opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateX(110%); opacity: 0; }
        }
        @keyframes tl-pulse-line {
          0%, 100% { width: 26%; opacity: .45; }
          50% { width: 94%; opacity: 1; }
        }
        @keyframes tl-reel {
          0%, 20% { transform: translateY(0); }
          25%, 45% { transform: translateY(-25%); }
          50%, 70% { transform: translateY(-50%); }
          75%, 95% { transform: translateY(-75%); }
          100% { transform: translateY(0); }
        }
        @keyframes tl-glow {
          0%, 100% { opacity: .35; transform: scale(.98); }
          50% { opacity: .75; transform: scale(1.04); }
        }
        @keyframes tl-risk {
          0%, 100% { box-shadow: 0 0 0 rgba(251, 146, 60, 0); }
          50% { box-shadow: 0 0 34px rgba(251, 146, 60, .32); }
        }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#05060a]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-black shadow-lg shadow-violet-950/40">TL</div>
            <div>
              <p className="text-sm font-black tracking-wide text-white">TeamLoad</p>
              <p className="text-[11px] text-gray-500">Coach OS for team sports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onGuest} className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-gray-400 transition-colors hover:text-white sm:block">
              View demo
            </button>
            <button onClick={onStart} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-gray-950 transition-transform hover:scale-[1.02] active:scale-[0.98]">
              Open TeamLoad
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen px-5 pb-16 pt-28 sm:pb-24 sm:pt-36">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-10 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="absolute right-[-120px] top-72 h-[520px] w-[520px] rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute left-[-180px] bottom-0 h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:100%_100%,56px_56px,56px_56px]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-100 shadow-xl shadow-violet-950/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                Product preview · sessions, attendance and load in one view
              </div>
              <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl">
                Know who is coming, who played and who is at risk.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-gray-400 sm:text-lg">
                TeamLoad gives coaches one operating screen for the week: plan sessions, see athlete exceptions, finalize attendance and turn participation into load context.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={onGuest} className="rounded-2xl bg-violet-500 px-7 py-4 text-sm font-black text-white shadow-2xl shadow-violet-950/50 transition-all hover:bg-violet-400 hover:shadow-violet-800/40 active:scale-[0.98]">
                  Watch interactive demo
                </button>
                <button onClick={onStart} className="rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-bold text-gray-200 backdrop-blur transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white">
                  Open TeamLoad
                </button>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                <Metric value="15" label="players tracked" />
                <Metric value="5" label="final states" />
                <Metric value="2" label="load alerts" />
              </div>
            </div>

            <CinematicHero />
          </div>
        </section>

        <section className="relative border-y border-white/10 bg-white/[0.02] px-5 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Product focus</p>
                <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">The operating layer between planning, attendance and load.</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {REEL_STEPS.map((step, index) => (
                  <div key={step} className="rounded-3xl border border-white/10 bg-gray-950/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">0{index + 1}</p>
                    <p className="mt-2 text-sm font-black text-white">{step}</p>
                    <div className="mt-4 h-1.5 rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${30 + index * 18}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(feature => <FeatureCard key={feature.title} feature={feature} />)}
            </div>
          </div>
        </section>

        <section className="px-5 py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Workflow</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Designed for the actual coaching week.</h2>
              <p className="mt-5 text-sm leading-7 text-gray-400">
                Most tools either track workouts or manage calendars. TeamLoad connects the pre-session, session-day and post-session layers so the coach has one source of truth.
              </p>
            </div>
            <div className="space-y-4">
              {WORKFLOW.map(item => (
                <div key={item.step} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition-transform hover:-translate-y-1">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-sm font-black text-violet-200">{item.step}</div>
                    <div>
                      <h3 className="text-lg font-black text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-400">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] px-5 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Who buys this</p>
                <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Built for the person who owns the weekly chaos.</h2>
                <p className="mt-5 text-sm leading-7 text-gray-400">
                  The first customer is not a casual athlete. It is the coach, coordinator or performance lead who needs fewer excuses, cleaner attendance and better load context.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {BUYER_SIGNALS.map(signal => <BuyerCard key={signal.title} signal={signal} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Commercial direction</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Start free, then pay for shared team operations.</h2>
              <p className="mt-5 text-sm leading-7 text-gray-400">
                Pricing is not live yet. This direction makes the business model clear: demo is free, real cloud-synced team usage becomes the paid product.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PLANS.map(plan => <PlanCard key={plan.name} plan={plan} />)}
            </div>
          </div>
        </section>

        <section className="px-5 pb-24">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-white/[0.05] to-cyan-500/10 p-8 text-center shadow-2xl shadow-violet-950/30 sm:p-12">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            <p className="text-xs font-bold uppercase tracking-widest text-violet-200">Ready for the next build step</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black text-white sm:text-5xl">Turn your club workflow into a real product experience.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-gray-300">
              Start with the demo, choose your role, create sessions and see how athlete exceptions become coach-ready decisions.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button onClick={onGuest} className="rounded-2xl bg-white px-7 py-4 text-sm font-black text-gray-950 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                Try demo workspace
              </button>
              <button onClick={onStart} className="rounded-2xl border border-white/15 px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10">
                Open TeamLoad
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CinematicHero() {
  return (
    <div className="relative min-h-[660px] perspective-[1400px]">
      <div className="absolute inset-x-4 bottom-16 h-28 rounded-[100%] bg-violet-500/20 blur-3xl" style={{ animation: 'tl-glow 4.5s ease-in-out infinite' }} />

      <div className="absolute -left-2 top-12 hidden w-52 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl lg:block">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Tonight</p>
        <p className="mt-1 text-2xl font-black text-white">12 expected</p>
        <p className="mt-1 text-xs text-emerald-100/70">2 late · 1 maybe · 1 out</p>
      </div>

      <div className="absolute -right-1 top-24 hidden w-56 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-4 shadow-2xl shadow-orange-950/30 backdrop-blur-xl lg:block" style={{ animation: 'tl-risk 3.2s ease-in-out infinite' }}>
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Coach decision</p>
        <p className="mt-1 text-2xl font-black text-white">Reduce load</p>
        <p className="mt-1 text-xs text-orange-100/70">Elias M. ACWR 1.38 after late/partial week</p>
      </div>

      <div className="absolute inset-x-0 top-8 mx-auto max-w-[760px]" style={{ animation: 'tl-float 7s ease-in-out infinite', transformStyle: 'preserve-3d' }}>
        <div className="relative rotate-[-1deg] rounded-[2rem] border border-white/15 bg-gray-950/90 p-3 shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <div className="absolute -inset-0.5 -z-10 rounded-[2.1rem] bg-gradient-to-br from-violet-500/55 via-cyan-400/25 to-orange-400/25 blur-xl" />
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#080a12]">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">TeamLoad Coach Dashboard</p>
                <h3 className="mt-1 text-lg font-black text-white">Munich Hoops Academy · U18 Boys</h3>
              </div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">Demo data</div>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-cyan-400/20 to-transparent" style={{ animation: 'tl-scan 3.8s ease-in-out infinite' }} />
                  <div className="relative flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Today · 18:30 · Main Court</p>
                      <h4 className="mt-1 text-xl font-black text-white">U18 Practice</h4>
                      <p className="mt-1 text-xs text-gray-500">Defense shell + small-sided games</p>
                    </div>
                    <div className="rounded-2xl bg-violet-500/15 px-4 py-3 text-center">
                      <p className="text-2xl font-black text-violet-200">15</p>
                      <p className="text-[10px] font-bold uppercase text-violet-300">roster</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <MiniCard label="Expected" value="12" tone="text-emerald-300" />
                  <MiniCard label="Late" value="2" tone="text-amber-300" />
                  <MiniCard label="Maybe / No" value="4" tone="text-rose-300" />
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Athlete exceptions</p>
                    <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-black text-amber-300">Coach sees this before practice</span>
                  </div>
                  <div className="space-y-2">
                    <AvailabilityPreview name="Elias M." status="20 min late" text="School ends later" accent="amber" />
                    <AvailabilityPreview name="Leo S." status="Maybe" text="Knee tight, decide after warm-up" accent="gray" />
                    <AvailabilityPreview name="Mika T." status="No" text="Sick" accent="rose" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Final attendance</p>
                    <div className="mt-3 space-y-2">
                      {FINAL_STATES.slice(0, 4).map((state, index) => (
                        <div key={state} className="flex items-center justify-between rounded-xl border border-white/10 bg-gray-900/80 px-3 py-2">
                          <span className="text-xs font-bold text-gray-300">{state}</span>
                          <span className="text-xs font-black text-white">{[9, 2, 1, 3][index]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="h-44 overflow-hidden rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">What happens next</p>
                    <div className="mt-3 h-28 overflow-hidden">
                      <div className="space-y-3" style={{ animation: 'tl-reel 9s ease-in-out infinite' }}>
                        {REEL_STEPS.map(step => (
                          <div key={step} className="h-28 rounded-2xl border border-cyan-400/20 bg-gray-950/50 p-3">
                            <p className="text-sm font-black text-white">{step}</p>
                            <p className="mt-1 text-xs text-cyan-100/70">TeamLoad keeps the next action visible.</p>
                            <div className="mt-3 h-1.5 rounded-full bg-gray-800">
                              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ animation: 'tl-pulse-line 2.2s ease-in-out infinite' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-orange-400/25 bg-orange-400/10 p-4 shadow-2xl shadow-orange-950/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Load monitor</p>
                      <h4 className="mt-1 text-lg font-black text-white">Attendance becomes load context</h4>
                      <p className="mt-1 text-xs leading-5 text-orange-100/70">Late, partial and missed sessions are visible before the next training decision.</p>
                    </div>
                    <span className="rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[10px] font-black text-orange-200">ACWR 1.38</span>
                  </div>

                  <div className="mt-5 flex h-32 items-end gap-2 rounded-2xl border border-white/10 bg-gray-950/55 px-3 pb-3 pt-5">
                    {LOAD_POINTS.map((height, index) => (
                      <div key={index} className="relative flex flex-1 justify-center">
                        {index === 5 && <span className="absolute -top-5 text-[9px] font-black text-orange-300">risk</span>}
                        <div className={`w-full rounded-t-lg ${height > 82 ? 'bg-gradient-to-t from-orange-500 to-red-400' : 'bg-gradient-to-t from-violet-500 to-cyan-400'}`} style={{ height }} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <LoadChip label="Optimal" value="6" tone="green" />
                    <LoadChip label="Elevated" value="2" tone="amber" />
                    <LoadChip label="Return" value="1" tone="blue" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[0.025] px-5 py-3">
              <div className="grid gap-2 text-[11px] font-bold text-gray-400 sm:grid-cols-4">
                <span>1. Plan session</span>
                <span>2. Athletes report exceptions</span>
                <span>3. Coach finalizes attendance</span>
                <span>4. Load graph updates context</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function MiniCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function LoadChip({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'blue' }) {
  const tones = {
    green: 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300',
    amber: 'border-amber-700/50 bg-amber-950/30 text-amber-300',
    blue: 'border-blue-700/50 bg-blue-950/30 text-blue-300',
  };
  return (
    <div className={`rounded-xl border px-2 py-2 ${tones[tone]}`}>
      <p className="text-base font-black leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

function AvailabilityPreview({ name, status, text, accent }: { name: string; status: string; text: string; accent: 'amber' | 'gray' | 'rose' }) {
  const tones = {
    amber: 'border-amber-700/50 bg-amber-950/25 text-amber-200',
    gray: 'border-gray-700 bg-gray-900 text-gray-200',
    rose: 'border-rose-700/50 bg-rose-950/25 text-rose-200',
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div>
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="mt-0.5 text-xs text-gray-500">{text}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${tones[accent]}`}>{status}</span>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gray-950/70 p-5 transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-gray-900/70">
      <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">{feature.eyebrow}</p>
      <h3 className="mt-3 text-lg font-black text-white">{feature.title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-400">{feature.text}</p>
    </div>
  );
}

function BuyerCard({ signal }: { signal: BuyerSignal }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gray-950/70 p-5 transition-transform hover:-translate-y-1">
      <h3 className="text-lg font-black text-white">{signal.title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-400">{signal.text}</p>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={`rounded-3xl border p-6 transition-transform hover:-translate-y-1 ${plan.highlighted ? 'border-violet-400/50 bg-violet-500/10 shadow-2xl shadow-violet-950/30' : 'border-white/10 bg-white/[0.03]'}`}>
      {plan.highlighted && <p className="mb-3 w-fit rounded-full bg-violet-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">Likely first paid plan</p>}
      <h3 className="text-xl font-black text-white">{plan.name}</h3>
      <p className="mt-2 text-2xl font-black text-white">{plan.price}</p>
      <p className="mt-3 text-sm leading-6 text-gray-400">{plan.description}</p>
      <ul className="mt-5 space-y-2">
        {plan.features.map(feature => (
          <li key={feature} className="flex gap-2 text-sm text-gray-300">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
