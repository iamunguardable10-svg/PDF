import { useEffect, useRef, useState } from 'react';

interface Props {
  onStart: () => void;   // → Login/Register
  onGuest: () => void;   // → direkt als Gast
}

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, decimals = 2) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setValue(parseFloat((ease * target).toFixed(decimals)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, decimals]);

  return { value, ref };
}

// ── Scroll-fade hook ──────────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, color, delay }: {
  icon: string; title: string; desc: string; color: string; delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(32px)';
    el.style.transition = `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`;
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref}
      className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.14] rounded-3xl p-6 transition-all duration-300 cursor-default">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: color + '22', border: `1px solid ${color}44` }}>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.1rem', letterSpacing: '0.02em' }}>
        {title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 30%, ${color}08, transparent 60%)` }} />
    </div>
  );
}

// ── ACWR Zone bar ─────────────────────────────────────────────────────────────
function ZoneBar({ acwr }: { acwr: number }) {
  const pct = Math.min(100, Math.max(0, (acwr / 2) * 100));
  const color = acwr < 0.8 ? '#60a5fa' : acwr <= 1.3 ? '#22c55e' : '#f87171';
  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, #60a5fa 0%, #60a5fa 32%, #22c55e 40%, #22c55e 72%, #f87171 82%, #f87171 100%)' }}>
        <div className="absolute top-0 bottom-0 flex items-center transition-all duration-1000"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
          <div className="w-4 h-4 bg-white rounded-full shadow-lg" style={{ boxShadow: `0 0 8px ${color}` }} />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 px-0.5">
        <span>Unterbelastet</span><span className="text-green-500">Optimal</span><span>Überbelastet</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LandingPage({ onStart, onGuest }: Props) {
  const acwr = useCountUp(1.07, 1600);
  const acute = useCountUp(412, 1400, 0);
  const chronic = useCountUp(385, 1800, 0);

  const featuresRef = useFadeIn();
  const acwrRef = useFadeIn();
  const trainerRef = useFadeIn();
  const ctaRef = useFadeIn();

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.05] bg-[#0a0b0f]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center text-sm shadow-lg">
              🥗
            </div>
            <span className="font-bold text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.1rem', letterSpacing: '0.04em' }}>
              FITFUEL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onGuest} className="text-sm text-gray-500 hover:text-white transition-colors px-3 py-1.5">
              Gast-Modus
            </button>
            <button onClick={onStart}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white transition-all duration-200 shadow-lg shadow-orange-900/30 hover:shadow-orange-900/50 hover:scale-[1.03] active:scale-[0.97]">
              Anmelden
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-20 pb-16 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }} />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
          KI-gestütztes Athleten-Tracking
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 leading-[1.05] tracking-tight"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          Trainiere smarter.<br />
          <span className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
            Nicht härter.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-gray-400 max-w-xl mb-10 leading-relaxed">
          FitFuel überwacht deinen Acute:Chronic Workload Ratio, berechnet deinen Ernährungsbedarf
          und gibt deinem Trainer Live-Einblick — alles auf einem Blick.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-sm sm:max-w-none">
          <button onClick={onStart}
            className="px-8 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-base transition-all duration-200 shadow-xl shadow-orange-900/40 hover:shadow-orange-900/60 hover:scale-[1.02] active:scale-[0.98]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em', fontSize: '1.05rem' }}>
            Kostenlos starten →
          </button>
          <button onClick={onGuest}
            className="px-8 py-4 rounded-2xl border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-medium text-sm transition-all duration-200 hover:bg-white/[0.03]">
            Als Gast testen
          </button>
        </div>

        {/* Hero ACWR card */}
        <div className="mt-16 w-full max-w-sm mx-auto">
          <div className="relative bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 text-left backdrop-blur-sm">
            <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
            <div className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wider">Dein aktueller ACWR</div>
            <div className="flex items-end gap-4 mb-5">
              <div>
                <span ref={acwr.ref} className="text-6xl font-black text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {acwr.value.toFixed(2)}
                </span>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/15 border border-green-500/25 ml-3">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <span className="text-xs text-green-400 font-semibold">Optimal</span>
                </div>
              </div>
            </div>
            <ZoneBar acwr={acwr.value} />
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-white/[0.03] rounded-2xl p-3">
                <div className="text-xs text-gray-500 mb-1">Acute Load (7d)</div>
                <div className="text-xl font-bold text-blue-400" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  <span ref={acute.ref}>{acute.value}</span> <span className="text-xs font-normal text-gray-500">AU</span>
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-2xl p-3">
                <div className="text-xs text-gray-500 mb-1">Chronic Load (28d)</div>
                <div className="text-xl font-bold text-amber-400" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  <span ref={chronic.ref}>{chronic.value}</span> <span className="text-xs font-normal text-gray-500">AU</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-5 max-w-5xl mx-auto">
        <div ref={featuresRef} className="text-center mb-12">
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Alles was du brauchst.
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">Ein Tool für Belastungssteuerung, Ernährung und Trainerkomm­unikation.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard delay={0}
            icon="📊" color="#f97316"
            title="ACWR Monitoring"
            desc="Beobachte deinen Acute:Chronic Workload Ratio täglich. Erkenne Übertrainingsphasen bevor sie passieren." />
          <FeatureCard delay={100}
            icon="🏋️" color="#a78bfa"
            title="Trainings-Tracking"
            desc="Erfasse jede Einheit mit RPE und Dauer. Plane voraus, trage Vergangenes nach — der Graph passt sich an." />
          <FeatureCard delay={200}
            icon="🥗" color="#22c55e"
            title="Ernährungsplan"
            desc="KI-generierte Mahlzeitenpläne basierend auf deinem ACWR, Trainingsziel und persönlichem Profil." />
          <FeatureCard delay={300}
            icon="🔗" color="#38bdf8"
            title="Trainer-Link"
            desc="Teile einen Live-Link mit deinem Coach. Er sieht deinen Load in Echtzeit — sicher, ohne Login." />
        </div>
      </section>

      {/* ── ACWR Erklärung ── */}
      <section className="py-20 px-5">
        <div ref={acwrRef} className="max-w-3xl mx-auto">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 sm:p-12">
            <div className="text-xs text-orange-500 font-semibold uppercase tracking-widest mb-3">Warum ACWR?</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Verletzungen entstehen nicht beim Training —<br />
              <span className="text-orange-400">sondern danach.</span>
            </h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Der Acute:Chronic Workload Ratio vergleicht deine Belastung der letzten 7 Tage
              mit dem 28-Tage-Durchschnitt. Liegt er über 1.3, steigt das Verletzungsrisiko
              signifikant — Studien zeigen bis zu 4× höheres Risiko.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { range: '< 0.8', label: 'Unterbelastet', color: '#60a5fa', desc: 'Zu wenig Reiz für Adaptation' },
                { range: '0.8 – 1.3', label: 'Optimal', color: '#22c55e', desc: 'Ideale Balance' },
                { range: '> 1.3', label: 'Risikozone', color: '#f87171', desc: 'Erhöhtes Verletzungsrisiko' },
              ].map(z => (
                <div key={z.range} className="rounded-2xl p-3 sm:p-4 text-center border"
                  style={{ backgroundColor: z.color + '12', borderColor: z.color + '30' }}>
                  <div className="text-lg sm:text-2xl font-black mb-1" style={{ color: z.color, fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {z.range}
                  </div>
                  <div className="text-xs font-semibold text-white mb-1">{z.label}</div>
                  <div className="text-[10px] text-gray-500 hidden sm:block">{z.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trainer Feature ── */}
      <section className="py-20 px-5 max-w-5xl mx-auto">
        <div ref={trainerRef} className="grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-xs text-sky-400 font-semibold uppercase tracking-widest mb-3">Für Trainer & Coaches</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Live-Einblick.<br />Ohne App. Ohne Login.
            </h2>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Teile einen sicheren Link mit deinem Trainer. Er sieht deinen ACWR-Verlauf,
              geplante Einheiten und aktuelle Belastung — immer aktuell, in Echtzeit.
            </p>
            <ul className="space-y-3">
              {[
                ['🔐', 'Sicher & widerrufbar jederzeit'],
                ['📡', 'Live-Daten, kein statischer Export'],
                ['👁', 'Trainer braucht keinen Account'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="text-base">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-3xl p-6">
              <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Live · Trainer-Ansicht</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">ACWR — Jan Müller · Fußball</div>
              <div className="text-5xl font-black text-white mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>1.07</div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/15 border border-green-500/25 mb-4">
                <span className="text-xs text-green-400 font-semibold">Optimal — gute Balance</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Acute Load (7d Ø)', value: '412 AU', color: 'text-blue-400' },
                  { label: 'Chronic Load (28d Ø)', value: '385 AU', color: 'text-amber-400' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.label}</span>
                    <span className={`font-bold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-5 text-center">
        <div ref={ctaRef} className="max-w-xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-white mb-5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Bereit smarter<br />zu trainieren?
            </h2>
            <p className="text-gray-500 mb-8">Kostenlos. Keine Kreditkarte. Sofort loslegen.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={onStart}
                className="px-10 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-base transition-all duration-200 shadow-2xl shadow-orange-900/40 hover:scale-[1.02] active:scale-[0.98]"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em', fontSize: '1.1rem' }}>
                Konto erstellen →
              </button>
              <button onClick={onGuest}
                className="px-10 py-4 rounded-2xl border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-medium transition-all duration-200 hover:bg-white/[0.03]">
                Als Gast testen
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-8 px-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm">🥗</span>
          <span className="text-sm font-bold text-gray-500" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em' }}>FITFUEL</span>
        </div>
        <p className="text-xs text-gray-700">KI-Gesundheitsassistent für Athleten</p>
      </footer>
    </div>
  );
}
