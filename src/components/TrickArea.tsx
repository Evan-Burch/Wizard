import { Trick, Suit, PlayerPosition } from '../types';
import { Card } from './Card';

interface TrickAreaProps {
  trick: Trick;
  trumpSuit: Suit | null;
  playerPositions: Record<number, PlayerPosition>;
}

const PLAYER_OFFSETS: Record<PlayerPosition, { x: number; y: number }> = {
  bottom: { x: 0, y: 50 },
  left:   { x: -50, y: 0 },
  top:    { x: 0, y: -50 },
  right:  { x: 50, y: 0 },
};

export function TrickArea({ trick, trumpSuit: _trumpSuit, playerPositions }: TrickAreaProps) {
  if (trick.cards.length === 0) return null;

  return (
    <div className="trick-area">
      {trick.cards.map(({ playerId, card }, index) => {
        const pos = playerPositions[playerId] || 'bottom';
        const offset = PLAYER_OFFSETS[pos];

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
