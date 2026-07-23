import { Card as CardType, PlayerPosition } from '../types';
import { Card } from './Card';

interface HandProps {
  cards: CardType[];
  position: PlayerPosition;
  onCardClick?: (card: CardType) => void;
  playableIds?: Set<string>;
}

export function Hand({ cards, position, onCardClick, playableIds }: HandProps) {
  if (position === 'bottom') {
    return (
      <div className="hand hand-bottom">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onClick={() => onCardClick?.(card)}
            disabled={playableIds ? !playableIds.has(card.id) : false}
          />
        ))}
      </div>
    );
  }

  return null;
}
