import { Card, Suit } from '../types';
import { Card as CardComponent } from './Card';

interface TrumpIndicatorProps {
  trumpSuit: Suit | null;
  flippedCard: Card | null;
}

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export function TrumpIndicator({ trumpSuit, flippedCard }: TrumpIndicatorProps) {
  const label = trumpSuit !== null
    ? `Trump ${SUIT_SYMBOL[trumpSuit]}`
    : 'No Trump';

  return (
    <div className="trump-indicator">
      <div className="trump-card-wrap">
        {flippedCard ? (
          <CardComponent card={flippedCard} />
        ) : (
          <div className="card card-back cursor-default" />
        )}
      </div>
      <div className="trump-label">{flippedCard ? label : 'No Trump'}</div>
    </div>
  );
}
