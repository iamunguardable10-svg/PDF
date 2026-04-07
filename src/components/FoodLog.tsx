import { useState, useRef } from 'react';
import type { FoodEntry, MealType } from '../types/food';
import { MEAL_LABELS, MEAL_EMOJI, sumEntries } from '../types/food';
import { lookupBarcode, analyzeFoodPhoto } from '../lib/foodApi';

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

const EMPTY_FORM = {
  name: '', calories: 0, protein: 0, carbs: 0, fat: 0, amount: '100g',
};

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  const over = value > target;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={over ? 'text-red-400' : 'text-gray-300'}>
          {value}g <span className="text-gray-600">/ {target}g</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FoodLog({ entries, targetCalories, targetProtein, targetCarbs, targetFat, onAdd, onDelete }: Props) {
  const [mode, setMode] = useState<InputMode>('manual');
  const [showForm, setShowForm] = useState(false);
  const [mealType, setMealType] = useState<MealType>('mittagessen');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [barcode, setBarcode] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const totals = sumEntries(entries);
  const calPct = Math.min(100, targetCalories > 0 ? (totals.totalCalories / targetCalories) * 100 : 0);
  const calOver = totals.totalCalories > targetCalories;

  const grouped = (Object.keys(MEAL_LABELS) as MealType[]).map(mt => ({
    type: mt,
    entries: entries.filter(e => e.mealType === mt),
  })).filter(g => g.entries.length > 0);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setBarcode('');
    setError('');
    setLoadingMsg('');
  };

  const handleAdd = () => {
    if (!form.name.trim()) { setError('Name fehlt'); return; }
    onAdd({
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      mealType,
      name: form.name,
      calories: form.calories,
      protein: form.protein,
      carbs: form.carbs,
      fat: form.fat,
      amount: form.amount || undefined,
      source: mode,
      barcode: mode === 'barcode' ? barcode : undefined,
    });
    resetForm();
    setShowForm(false);
  };

  const handleBarcodeFile = async (file: File) => {
    setLoading(true);
    setLoadingMsg('Barcode wird gescannt…');
    setError('');
    try {
      // Try BarcodeDetector API first (Chrome/Edge)
      let barcodeValue = '';
      if ('BarcodeDetector' in window) {
        const img = await createImageBitmap(file);
        // @ts-expect-error BarcodeDetector not in all TS libs
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const codes = await detector.detect(img);
        if (codes.length > 0) barcodeValue = codes[0].rawValue;
      }

      if (!barcodeValue) {
        setError('Kein Barcode erkannt. Gib den Code manuell ein.');
        setLoading(false);
        return;
      }

      setBarcode(barcodeValue);
      setLoadingMsg(`Barcode ${barcodeValue} — suche in Open Food Facts…`);
      const result = await lookupBarcode(barcodeValue);
      if (!result) {
        setError('Produkt nicht gefunden. Bitte manuell eintragen.');
        setLoading(false);
        return;
      }
      setForm({ name: result.name, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, amount: result.amount });
    } catch (e) {
      setError('Fehler beim Scannen. Bitte manuell eintragen.');
    }
    setLoading(false);
    setLoadingMsg('');
  };

  const handlePhotoFile = async (file: File) => {
    setLoading(true);
    setLoadingMsg('KI analysiert dein Essen…');
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await analyzeFoodPhoto(base64, file.type);
      if (!result) {
        setError('Essen konnte nicht erkannt werden. Bitte manuell eintragen.');
        setLoading(false);
        return;
      }
      setForm({ name: result.name, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, amount: result.amount });
      if (result.confidence === 'gering') {
        setError(`⚠️ Geringe Erkennungssicherheit — bitte Werte prüfen.`);
      }
    } catch {
      setError('Fehler bei der Analyse. Bitte manuell eintragen.');
    }
    setLoading(false);
    setLoadingMsg('');
  };

  return (
    <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">📒</span>
        <div>
          <h2 className="text-lg font-semibold text-white">Ernährungstagebuch</h2>
          <p className="text-sm text-gray-400">Heute</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="ml-auto px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          + Eintrag
        </button>
      </div>

      {/* Calorie ring summary */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${calOver ? 'text-red-400' : 'text-white'}`}>
              {totals.totalCalories}
            </div>
            <div className="text-xs text-gray-500">von {targetCalories} kcal</div>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${calOver ? 'bg-red-500' : 'bg-violet-500'}`}
                style={{ width: `${calPct}%` }}
              />
            </div>
            <div className="space-y-1.5">
              <MacroBar label="Protein" value={totals.totalProtein} target={targetProtein} color="bg-orange-500" />
              <MacroBar label="Kohlenhydrate" value={totals.totalCarbs} target={targetCarbs} color="bg-blue-500" />
              <MacroBar label="Fett" value={totals.totalFat} target={targetFat} color="bg-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Entries grouped by meal */}
      {grouped.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          <div className="text-4xl mb-2">🍽️</div>
          <p className="text-sm">Noch keine Einträge für heute</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ type, entries: groupEntries }) => (
            <div key={type}>
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide mb-2">
                <span>{MEAL_EMOJI[type]}</span>
                <span>{MEAL_LABELS[type]}</span>
                <span className="ml-auto text-gray-600">
                  {groupEntries.reduce((s, e) => s + e.calories, 0)} kcal
                </span>
              </div>
              <div className="space-y-1.5">
                {groupEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-2.5 border border-gray-800">
                    <div className="text-sm">
                      {entry.source === 'barcode' ? '🔖' : entry.source === 'photo' ? '📷' : '✏️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{entry.name}</div>
                      <div className="text-xs text-gray-500">
                        {entry.amount && `${entry.amount} · `}
                        P {entry.protein}g · KH {entry.carbs}g · F {entry.fat}g
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-orange-400 shrink-0">{entry.calories} kcal</div>
                    <button onClick={() => onDelete(entry.id)} className="text-gray-700 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add food modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Essen eintragen</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Meal type */}
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(MEAL_LABELS) as MealType[]).map(mt => (
                  <button key={mt} onClick={() => setMealType(mt)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${mealType === mt ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {MEAL_EMOJI[mt]}<br />{MEAL_LABELS[mt].split('essen')[0] || MEAL_LABELS[mt]}
                  </button>
                ))}
              </div>

              {/* Input mode tabs */}
              <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
                {([['manual', '✏️ Manuell'], ['barcode', '🔖 Barcode'], ['photo', '📷 Foto']] as [InputMode, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => { setMode(m); resetForm(); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Barcode mode */}
              {mode === 'barcode' && (
                <div className="space-y-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-500 text-gray-400 hover:text-white text-sm transition-all"
                  >
                    📸 Barcode-Foto hochladen
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => e.target.files?.[0] && handleBarcodeFile(e.target.files[0])} />
                  <div className="flex gap-2">
                    <input
                      type="text" placeholder="Oder Barcode manuell eingeben (EAN)"
                      value={barcode} onChange={e => setBarcode(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                    <button
                      onClick={async () => {
                        if (!barcode) return;
                        setLoading(true);
                        setLoadingMsg('Suche Produkt…');
                        const r = await lookupBarcode(barcode);
                        setLoading(false);
                        setLoadingMsg('');
                        if (r) setForm({ name: r.name, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, amount: r.amount });
                        else setError('Produkt nicht gefunden.');
                      }}
                      className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm transition-colors"
                    >
                      Suchen
                    </button>
                  </div>
                </div>
              )}

              {/* Photo mode */}
              {mode === 'photo' && (
                <div>
                  <button
                    onClick={() => photoRef.current?.click()}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-500 text-center transition-all group"
                  >
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-sm text-gray-400 group-hover:text-white transition-colors">
                      Foto machen oder hochladen
                    </div>
                    <div className="text-xs text-gray-600 mt-1">KI erkennt Essen und schätzt Nährwerte</div>
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0])} />
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3 text-sm text-gray-300">
                  <svg className="animate-spin w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {loadingMsg}
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">{error}</div>
              )}

              {/* Manual fields (also shown after barcode/photo lookup) */}
              <div className="space-y-3">
                <input
                  type="text" placeholder="Name des Essens"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Menge (z.B. 200g)"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
                  <div className="relative">
                    <input type="number" placeholder="Kalorien"
                      value={form.calories || ''} onChange={e => setForm(f => ({ ...f, calories: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 pr-12" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">kcal</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([['Protein', 'protein', 'g'], ['Kohlenhydr.', 'carbs', 'g'], ['Fett', 'fat', 'g']] as [string, keyof typeof form, string][]).map(([label, key, unit]) => (
                    <div key={key} className="relative">
                      <input type="number" placeholder={label}
                        value={(form[key] as number) || ''}
                        onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 pr-6" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">{unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || loading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${form.name.trim() && !loading ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
