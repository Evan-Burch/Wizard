import { Card, Suit } from '../types';
import { Card as CardComponent } from './Card';
import { getSuitSymbol } from '../engine/wizard';

interface TrumpIndicatorProps {
  trumpSuit: Suit | null;
  flippedCard: Card | null;
}

export function TrumpIndicator({ trumpSuit, flippedCard }: TrumpIndicatorProps) {
  if (!flippedCard) return null;

  return (
    <div className="trump-indicator">
      <CardComponent card={flippedCard} />
      <div className="trump-label">
        {trumpSuit ? (
          <>
            <span className="trump-suit-symbol">{getSuitSymbol(trumpSuit)}</span>
            <span>Trump</span>
          </>
        ) : (
          <span>No Trump</span>
        )}
      </div>
    </div>
  );
}
