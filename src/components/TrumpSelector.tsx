import { Suit } from '../types';

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
  availableSuits: Suit[];
}

const SUIT_INFO: Record<Suit, { symbol: string; color: string }> = {
  hearts: { symbol: '\u2665', color: '#d40000' },
  diamonds: { symbol: '\u2666', color: '#d40000' },
  clubs: { symbol: '\u2663', color: '#1a1a2e' },
  spades: { symbol: '\u2660', color: '#1a1a2e' },
};

export function TrumpSelector({ onSelect, availableSuits }: TrumpSelectorProps) {
  return (
    <div className="popup-panel absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 bg-white px-5 py-3.5">
      <div className="text-sm font-bold text-gray-900">Pick a trump suit:</div>
      <div className="flex gap-2.5">
        {availableSuits.map((suit) => {
          const { symbol, color } = SUIT_INFO[suit];
          return (
            <button
              key={suit}
              className="flex cursor-pointer flex-col items-center gap-1 rounded border border-gray-300 bg-gray-50 px-3.5 py-2.5 transition-all hover:scale-105 hover:border-gray-400 hover:bg-gray-100"
              style={{ color }}
              onClick={() => onSelect(suit)}
            >
              <span className="text-[28px] leading-none">{symbol}</span>
              <span className="text-[11px] text-gray-600">{suit.charAt(0).toUpperCase() + suit.slice(1)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
