import { Trick, Suit } from '../types';
import { Card } from './Card';

interface TrickAreaProps {
  trick: Trick;
  trumpSuit: Suit | null;
  playerPositions: Record<number, string>;
}

const PLAYER_OFFSETS: Record<string, { x: number; y: number }> = {
  bottom: { x: 0, y: 40 },
  left:   { x: -40, y: 0 },
  top:    { x: 0, y: -40 },
  right:  { x: 40, y: 0 },
};

export function TrickArea({ trick, trumpSuit: _trumpSuit, playerPositions }: TrickAreaProps) {
  if (trick.cards.length === 0) return null;

  return (
    <div className="trick-area">
      {trick.cards.map(({ playerId, card }, index) => {
        const pos = playerPositions[playerId] || 'bottom';
        const offset = PLAYER_OFFSETS[pos] ?? PLAYER_OFFSETS.bottom;

        return (
          <div
            key={`${playerId}-${card.id}`}
            className="trick-card-slot"
            style={{
              '--slot-x': `${offset.x}px`,
              '--slot-y': `${offset.y}px`,
              '--slot-rot': '0deg',
              zIndex: index + 1,
              animationDelay: `${index * 80}ms`,
            } as React.CSSProperties}
          >
            <Card card={card} />
          </div>
        );
      })}
    </div>
  );
}
