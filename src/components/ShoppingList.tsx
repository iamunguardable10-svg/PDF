import { useState } from 'react';
import type { ShoppingItem } from '../types/health';

interface Props {
  items: ShoppingItem[];
  onItemToggle: (index: number) => void;
  onOrder: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Obst & Gemüse': '🥦',
  'Fleisch & Fisch': '🥩',
  'Milchprodukte': '🥛',
  'Getreide & Hülsenfrüchte': '🌾',
  'Snacks & Sonstiges': '🛒',
};

export function ShoppingList({ items, onItemToggle, onOrder }: Props) {
  const [orderLoading, setOrderLoading] = useState(false);
  const [ordered, setOrdered] = useState(false);

  if (items.length === 0) return null;

  const grouped = items.reduce((acc, item, idx) => {
    const cat = item.category || 'Sonstiges';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...item, _idx: idx });
    return acc;
  }, {} as Record<string, (ShoppingItem & { _idx: number })[]>);

  const uncheckedCount = items.filter(i => !i.checked).length;
  const totalCount = items.length;

  const handleOrder = () => {
    setOrderLoading(true);
    setTimeout(() => {
      setOrderLoading(false);
      setOrdered(true);
    }, 2000);
    onOrder();
  };

  return (
    <div className="bg-gray-900/50 rounded-3xl border border-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">🛒 Einkaufsliste</h2>
          <span className="text-sm text-gray-400">{totalCount - uncheckedCount}/{totalCount}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${((totalCount - uncheckedCount) / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-6 space-y-5 max-h-96 overflow-y-auto">
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <span>{CATEGORY_EMOJI[category] || '🛍️'}</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category}</span>
            </div>
            <div className="space-y-1.5">
              {catItems.map((item) => (
                <button
                  key={item._idx}
                  onClick={() => onItemToggle(item._idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                    item.checked
                      ? 'opacity-40'
                      : 'hover:bg-gray-900'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    item.checked
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-600'
                  }`}>
                    {item.checked && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-500' : 'text-white'}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{item.amount}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Order button */}
      <div className="p-6 border-t border-gray-800">
        {ordered ? (
          <div className="bg-green-900/30 border border-green-800 rounded-2xl p-4 text-center">
            <div className="text-2xl mb-2">🎉</div>
            <div className="font-semibold text-green-400">Bestellung aufgegeben!</div>
            <div className="text-sm text-gray-400 mt-1">
              Lieferung morgen zwischen 7–12 Uhr via Knuspr
            </div>
          </div>
        ) : (
          <button
            onClick={handleOrder}
            disabled={orderLoading}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 ${
              orderLoading
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-900/30'
            }`}
          >
            {orderLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Wird bestellt...
              </>
            ) : (
              <>
                <span className="text-xl">🟢</span>
                Alles bei Knuspr bestellen
              </>
            )}
          </button>
        )}
        {!ordered && (
          <p className="text-xs text-gray-600 text-center mt-2">
            {uncheckedCount} Artikel · Lieferung morgen früh
          </p>
        )}
      </div>
    </div>
  );
}
