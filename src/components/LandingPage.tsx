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

export function LandingPage({ onStart, onGuest }: Props) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-950 text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-gray-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-black shadow-lg shadow-violet-950/40">TL</div>
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
        <section className="relative px-5 pb-16 pt-28 sm:pb-24 sm:pt-36">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-20 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute right-[-160px] top-80 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Built for coaches, teams and load-aware athletes
              </div>
              <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white sm:text-7xl">
                Run the team, not the spreadsheet.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-gray-400 sm:text-lg">
                TeamLoad combines session planning, athlete availability, coach-final attendance and workload monitoring in one focused operating system for team sports.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={onStart} className="rounded-2xl bg-violet-500 px-7 py-4 text-sm font-black text-white shadow-xl shadow-violet-950/40 transition-all hover:bg-violet-400 hover:shadow-violet-900/40 active:scale-[0.98]">
                  Open coach workspace
                </button>
                <button onClick={onGuest} className="rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-bold text-gray-300 transition-colors hover:border-white/20 hover:text-white">
                  Explore demo workspace
                </button>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                <Metric value="4" label="core layers" />
                <Metric value="5" label="final states" />
                <Metric value="1" label="coach board" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-gray-950 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Today</p>
                    <h2 className="mt-1 text-xl font-black text-white">U18 Practice</h2>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">18:30</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniCard label="Expected" value="12" tone="text-emerald-300" />
                  <MiniCard label="Late" value="2" tone="text-amber-300" />
                  <MiniCard label="Maybe / No" value="3" tone="text-rose-300" />
                </div>

                <div className="mt-5 space-y-3">
                  <AvailabilityPreview name="Elias M." status="20 min late" text="School ends later" accent="amber" />
                  <AvailabilityPreview name="Leo S." status="Maybe" text="Knee feels tight, decide after warm-up" accent="gray" />
                  <AvailabilityPreview name="Mika T." status="No" text="Sick" accent="rose" />
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Coach final attendance</p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {FINAL_STATES.map(state => (
                      <div key={state} className="rounded-xl border border-white/10 bg-gray-900 px-2 py-2 text-center text-[10px] font-bold text-gray-300">
                        {state}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Product focus</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">The operating layer between planning, attendance and load.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(feature => <FeatureCard key={feature.title} feature={feature} />)}
            </div>
          </div>
        </section>

        <section className="px-5 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Workflow</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Designed for the actual coaching week.</h2>
              <p className="mt-5 text-sm leading-7 text-gray-400">
                Most tools either track workouts or manage calendars. TeamLoad connects the pre-session, session-day and post-session layers so the coach has one source of truth.
              </p>
            </div>
            <div className="space-y-4">
              {WORKFLOW.map(item => (
                <div key={item.step} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
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
          <div className="mx-auto max-w-6xl">
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
          <div className="mx-auto max-w-6xl">
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
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-white/[0.04] to-cyan-500/10 p-8 text-center sm:p-12">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-200">Ready for the next build step</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black text-white sm:text-5xl">Turn your club workflow into a real product experience.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-gray-300">
              Start with the demo, choose your role, create sessions and see how athlete exceptions become coach-ready decisions.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button onClick={onStart} className="rounded-2xl bg-white px-7 py-4 text-sm font-black text-gray-950 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                Open TeamLoad
              </button>
              <button onClick={onGuest} className="rounded-2xl border border-white/15 px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10">
                Try demo workspace
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
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
    <div className="rounded-3xl border border-white/10 bg-gray-950/70 p-5 transition-colors hover:border-white/20 hover:bg-gray-900/70">
      <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">{feature.eyebrow}</p>
      <h3 className="mt-3 text-lg font-black text-white">{feature.title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-400">{feature.text}</p>
    </div>
  );
}

function BuyerCard({ signal }: { signal: BuyerSignal }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gray-950/70 p-5">
      <h3 className="text-lg font-black text-white">{signal.title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-400">{signal.text}</p>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={`rounded-3xl border p-6 ${plan.highlighted ? 'border-violet-400/50 bg-violet-500/10 shadow-2xl shadow-violet-950/30' : 'border-white/10 bg-white/[0.03]'}`}>
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
