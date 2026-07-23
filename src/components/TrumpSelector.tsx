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
    <div className="trump-selector">
      <div className="trump-selector-label">Pick a trump suit:</div>
      <div className="trump-selector-buttons">
        {availableSuits.map((suit) => {
          const { symbol, color } = SUIT_INFO[suit];
          return (
            <button
              key={suit}
              className="trump-suit-btn"
              style={{ color }}
              onClick={() => onSelect(suit)}
            >
              <span className="trump-suit-btn-symbol">{symbol}</span>
              <span className="trump-suit-btn-name">{suit.charAt(0).toUpperCase() + suit.slice(1)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
