import { useState, useRef, useEffect } from 'react';
import type { FoodEntry, MealType, DrinkType } from '../types/food';
import { MEAL_LABELS, MEAL_EMOJI, DRINK_LABELS, DRINK_EMOJI, sumEntries } from '../types/food';
import { lookupBarcode, analyzeFoodPhoto } from '../lib/foodApi';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface Props {
  entries: FoodEntry[];
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  onAdd: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}

type InputMode = 'manual' | 'barcode' | 'photo';

const EMPTY_FORM = { name: '', calories: 0, protein: 0, carbs: 0, fat: 0, amount: '' };

// Per-100g base values from barcode — used to scale by entered grams
interface Per100g { calories: number; protein: number; carbs: number; fat: number; }
function scaleNutrition(base: Per100g, grams: number): Omit<Per100g, never> {
  const f = grams / 100;
  return {
    calories: Math.round(base.calories * f),
    protein:  Math.round(base.protein  * f * 10) / 10,
    carbs:    Math.round(base.carbs    * f * 10) / 10,
    fat:      Math.round(base.fat      * f * 10) / 10,
  };
}

// EAN-8 or EAN-13
const isCompleteBarcode = (v: string) => /^\d{8}$/.test(v) || /^\d{13}$/.test(v);

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={value > target ? 'text-red-400' : 'text-gray-300'}>
          {value}g <span className="text-gray-600">/ {target}g</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${value > target ? 'bg-red-500' : color}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EntryRow({ entry, onDelete }: { entry: FoodEntry; onDelete: () => void }) {
  const emoji = entry.isDrink
    ? DRINK_EMOJI[entry.drinkType ?? 'sonstiges']
    : entry.source === 'barcode' ? '🔖' : entry.source === 'photo' ? '📷' : '✏️';
  return (
    <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-2.5 border border-gray-800">
      <span className="text-base shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{entry.name}</div>
        <div className="text-xs text-gray-500">
          {entry.amount && `${entry.amount} · `}
          {entry.isDrink ? (
            <span className="text-blue-400">{entry.calories} kcal</span>
          ) : (
            <>P {entry.protein}g · KH {entry.carbs}g · F {entry.fat}g</>
          )}
        </div>
      </div>
      <div className="text-sm font-semibold text-orange-400 shrink-0">{entry.calories} kcal</div>
      <button onClick={onDelete} className="text-gray-700 hover:text-red-400 transition-colors text-xl leading-none">×</button>
    </div>
  );
}

export function FoodLog({ entries, targetCalories, targetProtein, targetCarbs, targetFat, onAdd, onDelete }: Props) {
  const [tab, setTab] = useState<'essen' | 'trinken'>('essen');
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<InputMode>('manual');
  const [mealType, setMealType] = useState<MealType>('mittagessen');
  const [drinkType, setDrinkType] = useState<DrinkType>('wasser');
  const [form, setForm] = useState(EMPTY_FORM);
  const [per100g, setPer100g] = useState<Per100g | null>(null);  // set after barcode hit
  const [grams, setGrams] = useState<number>(100);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const isDrink = tab === 'trinken';
  const foodEntries = entries.filter(e => !e.isDrink);
  const drinkEntries = entries.filter(e => e.isDrink);

  const totals = sumEntries(entries);
  const calPct = Math.min(100, targetCalories > 0 ? (totals.totalCalories / targetCalories) * 100 : 0);
  const calOver = totals.totalCalories > targetCalories;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setBarcode('');
    setPer100g(null);
    setGrams(100);
    setError('');
    setLoadingMsg('');
  };

  // Auto-lookup when barcode is complete (EAN-8 or EAN-13)
  useEffect(() => {
    if (!isCompleteBarcode(barcode)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadingMsg(`Suche Produkt für ${barcode}…`);
      setError('');
      const r = await lookupBarcode(barcode);
      if (cancelled) return;
      setLoading(false);
      setLoadingMsg('');
      if (r) {
        // Store per-100g base; default to 100g portion
        const base = { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat };
        setPer100g(base);
        setGrams(100);
        setForm(f => ({ ...f, name: r.name, amount: '100g', ...scaleNutrition(base, 100) }));
      } else {
        setError('Produkt nicht gefunden. Bitte manuell eintragen.');
      }
    })();
    return () => { cancelled = true; };
  }, [barcode]);

  // Recalculate macros whenever the gram value changes (only for barcode hits)
  useEffect(() => {
    if (!per100g) return;
    const scaled = scaleNutrition(per100g, grams);
    setForm(f => ({ ...f, amount: `${grams}g`, ...scaled }));
  }, [grams, per100g]);

  const handleAdd = () => {
    if (!form.name.trim()) { setError('Name fehlt'); return; }
    onAdd({
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      isDrink,
      mealType: isDrink ? undefined : mealType,
      drinkType: isDrink ? drinkType : undefined,
      name: form.name,
      calories: form.calories,
      protein: isDrink ? 0 : form.protein,
      carbs: isDrink ? 0 : form.carbs,
      fat: isDrink ? 0 : form.fat,
      amount: form.amount || undefined,
      source: mode,
      barcode: mode === 'barcode' ? barcode : undefined,
    });
    resetForm();
    setShowForm(false);
  };

  const handleBarcodeFile = async (file: File) => {
    setLoading(true); setLoadingMsg('Barcode wird gescannt…'); setError('');
    try {
      // @zxing/browser works in all browsers including Safari
      const reader = new BrowserMultiFormatReader();
      const imgUrl = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(imgUrl);
      URL.revokeObjectURL(imgUrl);
      if (!result?.getText()) {
        setError('Kein Barcode erkannt. Code manuell eingeben.');
        setLoading(false);
        return;
      }
      setBarcode(result.getText()); // triggers auto-lookup via useEffect
    } catch {
      setError('Kein Barcode erkannt. Bitte manuell eingeben.');
      setLoading(false);
    }
  };

  const handlePhotoFile = async (file: File) => {
    setLoading(true); setLoadingMsg('KI analysiert dein Essen…'); setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await analyzeFoodPhoto(base64, file.type);
      if (!result) { setError('Nicht erkannt. Bitte manuell eintragen.'); setLoading(false); return; }
      setForm({ name: result.name, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, amount: result.amount });
      if (result.confidence === 'gering') setError('⚠️ Geringe Erkennungssicherheit — bitte Werte prüfen.');
    } catch { setError('Fehler bei der Analyse.'); }
    setLoading(false); setLoadingMsg('');
  };

  // Group food by meal type
  const foodGrouped = (Object.keys(MEAL_LABELS) as MealType[])
    .map(mt => ({ type: mt, entries: foodEntries.filter(e => e.mealType === mt) }))
    .filter(g => g.entries.length > 0);

  // Group drinks by drink type
  const drinkGrouped = (Object.keys(DRINK_LABELS) as DrinkType[])
    .map(dt => ({ type: dt, entries: drinkEntries.filter(e => e.drinkType === dt) }))
    .filter(g => g.entries.length > 0);

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">📒</span>
        <div>
          <h2 className="text-lg font-semibold text-white">Ernährungstagebuch</h2>
          <p className="text-sm text-gray-400">Heute</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="ml-auto px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
          + Eintrag
        </button>
      </div>

      {/* Daily summary */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${calOver ? 'text-red-400' : 'text-white'}`}>{totals.totalCalories}</div>
            <div className="text-xs text-gray-500">von {targetCalories} kcal</div>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${calOver ? 'bg-red-500' : 'bg-violet-500'}`}
                style={{ width: `${calPct}%` }} />
            </div>
            <div className="space-y-1.5">
              <MacroBar label="Protein" value={totals.totalProtein} target={targetProtein} color="bg-orange-500" />
              <MacroBar label="Kohlenhydrate" value={totals.totalCarbs} target={targetCarbs} color="bg-blue-500" />
              <MacroBar label="Fett" value={totals.totalFat} target={targetFat} color="bg-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Essen / Trinken tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        <button onClick={() => setTab('essen')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'essen' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          🍽️ Essen
          {foodEntries.length > 0 && <span className="bg-white/20 rounded-full text-xs px-1.5">{foodEntries.length}</span>}
        </button>
        <button onClick={() => setTab('trinken')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'trinken' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          💧 Trinken
          {drinkEntries.length > 0 && <span className="bg-white/20 rounded-full text-xs px-1.5">{drinkEntries.length}</span>}
        </button>
      </div>

      {/* Essen entries */}
      {tab === 'essen' && (
        foodGrouped.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <div className="text-4xl mb-2">🍽️</div>
            <p className="text-sm">Noch keine Mahlzeiten heute</p>
          </div>
        ) : (
          <div className="space-y-4">
            {foodGrouped.map(({ type, entries: g }) => (
              <div key={type}>
                <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide mb-2">
                  <span>{MEAL_EMOJI[type]}</span>
                  <span>{MEAL_LABELS[type]}</span>
                  <span className="ml-auto text-gray-600">{g.reduce((s, e) => s + e.calories, 0)} kcal</span>
                </div>
                <div className="space-y-1.5">
                  {g.map(e => <EntryRow key={e.id} entry={e} onDelete={() => onDelete(e.id)} />)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Trinken entries */}
      {tab === 'trinken' && (
        drinkGrouped.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <div className="text-4xl mb-2">💧</div>
            <p className="text-sm">Noch keine Getränke heute</p>
          </div>
        ) : (
          <div className="space-y-4">
            {drinkGrouped.map(({ type, entries: g }) => (
              <div key={type}>
                <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide mb-2">
                  <span>{DRINK_EMOJI[type]}</span>
                  <span>{DRINK_LABELS[type]}</span>
                  <span className="ml-auto text-gray-600">{g.reduce((s, e) => s + e.calories, 0)} kcal</span>
                </div>
                <div className="space-y-1.5">
                  {g.map(e => <EntryRow key={e.id} entry={e} onDelete={() => onDelete(e.id)} />)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h3 className="text-lg font-bold text-white">Eintrag hinzufügen</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Essen / Trinken toggle */}
              <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
                <button onClick={() => { setTab('essen'); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${!isDrink ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  🍽️ Essen
                </button>
                <button onClick={() => { setTab('trinken'); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${isDrink ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  💧 Trinken
                </button>
              </div>

              {/* Category selector */}
              {!isDrink ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.keys(MEAL_LABELS) as MealType[]).map(mt => (
                    <button key={mt} onClick={() => setMealType(mt)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all text-center ${mealType === mt ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      {MEAL_EMOJI[mt]}<br />{MEAL_LABELS[mt]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(DRINK_LABELS) as DrinkType[]).map(dt => (
                    <button key={dt} onClick={() => setDrinkType(dt)}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${drinkType === dt ? 'border-blue-500 bg-blue-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      {DRINK_EMOJI[dt]}<br />{DRINK_LABELS[dt]}
                    </button>
                  ))}
                </div>
              )}

              {/* Input mode — hide barcode/photo for drinks if desired, but let's keep it */}
              <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
                {(['manual', 'barcode', 'photo'] as InputMode[]).map(m => (
                  <button key={m} onClick={() => { setMode(m); resetForm(); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {m === 'manual' ? '✏️ Manuell' : m === 'barcode' ? '🔖 Barcode' : '📷 Foto'}
                  </button>
                ))}
              </div>

              {/* Barcode mode */}
              {mode === 'barcode' && (
                <div className="space-y-3">
                  {/* Scan / type input — only shown before product is found */}
                  {!per100g && (
                    <>
                      <button onClick={() => fileRef.current?.click()}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-500 text-gray-400 hover:text-white text-sm transition-all">
                        📸 Barcode-Foto hochladen
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => e.target.files?.[0] && handleBarcodeFile(e.target.files[0])} />
                      <div className="relative">
                        <input type="text" placeholder="EAN-Code eingeben (8 oder 13 Stellen)"
                          value={barcode} onChange={e => { setBarcode(e.target.value.replace(/\D/g, '')); setError(''); }}
                          maxLength={13}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-mono tracking-widest pr-10" />
                        {loading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="animate-spin w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {barcode.length > 0 && !isCompleteBarcode(barcode) && (
                        <p className="text-xs text-gray-600">{barcode.length}/13 Stellen — wird automatisch gesucht</p>
                      )}
                    </>
                  )}

                  {/* Product found — show name + gram input only */}
                  {per100g && form.name && (
                    <div className="bg-green-900/20 border border-green-800/50 rounded-2xl p-4 space-y-4">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 text-lg shrink-0">✓</span>
                        <div>
                          <div className="text-sm font-semibold text-white">{form.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            pro 100g: {per100g.calories} kcal · P {per100g.protein}g · KH {per100g.carbs}g · F {per100g.fat}g
                          </div>
                        </div>
                        <button onClick={() => { setPer100g(null); setBarcode(''); setForm(EMPTY_FORM); }}
                          className="ml-auto text-gray-600 hover:text-gray-400 text-sm shrink-0">↩ Neu</button>
                      </div>

                      {/* Gram input */}
                      <div>
                        <label className="text-xs text-gray-400 block mb-2">
                          Wie viel hast du gegessen?
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number" min={1} max={2000} step={5}
                            value={grams}
                            onChange={e => setGrams(Math.max(1, Number(e.target.value)))}
                            className="w-28 bg-gray-800 border border-violet-600 rounded-xl px-3 py-2.5 text-white text-lg font-bold focus:outline-none text-center"
                          />
                          <span className="text-gray-400 font-semibold">g</span>
                          <div className="flex gap-1.5 ml-auto">
                            {[50, 100, 150, 200, 250].map(g => (
                              <button key={g} onClick={() => setGrams(g)}
                                className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${grams === g ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 text-gray-500 hover:text-white hover:border-gray-600'}`}>
                                {g}g
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Live calculated values */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-gray-900/60 rounded-xl py-2">
                          <div className="text-base font-bold text-orange-400">{form.calories}</div>
                          <div className="text-xs text-gray-500">kcal</div>
                        </div>
                        <div className="bg-gray-900/60 rounded-xl py-2">
                          <div className="text-base font-bold text-orange-300">{form.protein}g</div>
                          <div className="text-xs text-gray-500">Protein</div>
                        </div>
                        <div className="bg-gray-900/60 rounded-xl py-2">
                          <div className="text-base font-bold text-blue-400">{form.carbs}g</div>
                          <div className="text-xs text-gray-500">KH</div>
                        </div>
                        <div className="bg-gray-900/60 rounded-xl py-2">
                          <div className="text-base font-bold text-yellow-400">{form.fat}g</div>
                          <div className="text-xs text-gray-500">Fett</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Photo mode */}
              {mode === 'photo' && (
                <div>
                  <button onClick={() => photoRef.current?.click()}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-500 text-center transition-all group">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-sm text-gray-400 group-hover:text-white">Foto aufnehmen oder hochladen</div>
                    <div className="text-xs text-gray-600 mt-1">KI schätzt Nährwerte automatisch</div>
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0])} />
                </div>
              )}

              {/* Loading */}
              {loading && loadingMsg && (
                <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3 text-sm text-gray-300">
                  <svg className="animate-spin w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {loadingMsg}
                </div>
              )}

              {error && <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

              {/* Fields */}
              <div className="space-y-3">
                <input type="text" placeholder={isDrink ? 'Name des Getränks' : 'Name des Essens'}
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder={isDrink ? 'Menge (z.B. 500ml)' : 'Menge (z.B. 200g)'}
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
                  <div className="relative">
                    <input type="number" placeholder="Kalorien"
                      value={form.calories || ''} onChange={e => setForm(f => ({ ...f, calories: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 pr-12" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">kcal</span>
                  </div>
                </div>
                {!isDrink && (
                  <div className="grid grid-cols-3 gap-2">
                    {(['protein', 'carbs', 'fat'] as const).map(key => (
                      <div key={key} className="relative">
                        <input type="number" placeholder={key === 'protein' ? 'Protein' : key === 'carbs' ? 'KH' : 'Fett'}
                          value={form[key] || ''}
                          onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">g</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleAdd} disabled={!form.name.trim() || loading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${form.name.trim() && !loading ? `${isDrink ? 'bg-blue-600 hover:bg-blue-500' : 'bg-violet-600 hover:bg-violet-500'} text-white` : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
