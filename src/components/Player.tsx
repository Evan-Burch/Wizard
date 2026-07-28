import { Player as PlayerType, PlayerPosition, Card } from '../types';
import { getSuitSymbol, getSuitColor } from '../engine/wizard';
import { AIPhase } from '../engine/ai-tf/pipeline';
import wizardImg from '../assets/wizard.png';
import jesterImg from '../assets/jester.png';

interface PlayerProps {
  player: PlayerType;
  isActive: boolean;
  isDealer: boolean;
  biddingPhase?: AIPhase;
  biddingConfidence?: number;
  cardPlayPhase?: AIPhase;
  cardPlayConfidence?: number;
}

const AVATAR_COLORS = ['#1565c0', '#c62828', '#2e7d32', '#6a1b9a'];

const MINI_CARD_ROTATION: Record<PlayerPosition, string> = {
  bottom: 'rotate(0deg)',
  right: 'rotate(-90deg)',
  top: 'rotate(180deg)',
  left: 'rotate(90deg)',
};

function MiniCardFace({ card }: { card: Card }) {
  if (card.special === 'wizard') {
    return <div className="tooltip-card wizard"><img src={wizardImg} alt="W" className="tooltip-card-img" /></div>;
  }
  if (card.special === 'jester') {
    return <div className="tooltip-card jester"><img src={jesterImg} alt="J" className="tooltip-card-img" /></div>;
  }
  const color = getSuitColor(card.suit!);
  return (
    <div className="tooltip-card face" style={{ color }}>
      <span>{card.rank}</span>
      <span>{getSuitSymbol(card.suit!)}</span>
    </div>
  );
}

export function Player({ player, isActive, isDealer, biddingPhase, biddingConfidence, cardPlayPhase, cardPlayConfidence }: PlayerProps) {
  const initial = player.name.charAt(0);
  const bgColor = AVATAR_COLORS[player.id];

  const bidTokens = player.bid !== null ? player.bid : 0;
  const wonTricks = player.tricksWon;
  const overTricks = wonTricks > bidTokens ? wonTricks - bidTokens : 0;
  const totalPiles = Math.max(bidTokens, wonTricks, 0);

  const tracker = player.bid === 0 && player.bid !== null ? (
    <div className="trick-tracker">
      <div className="bid-zero">0</div>
      {Array.from({ length: wonTricks }).map((_, i) => {
        const cardRot = MINI_CARD_ROTATION[player.position];
        const trickCards = player.tricks[i];
        return (
          <div
            key={i}
            className="trick-pile has-trick"
          >
            <div className="card-back-mini" style={{ transform: cardRot }} />
            {trickCards && (
              <div className="trick-tooltip">
                <div className="tooltip-cards">
                  {trickCards.map((c) => (
                    <MiniCardFace key={c.id} card={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : totalPiles > 0 ? (
    <div className="trick-tracker">
      {Array.from({ length: totalPiles }).map((_, i) => {
        const hasChip = i < bidTokens;
        const hasTrick = i < wonTricks;
        const isOver = i >= bidTokens;
        const cardRot = MINI_CARD_ROTATION[player.position];
        const trickCards = player.tricks[i];
        return (
          <div
            key={i}
            className={`trick-pile ${hasChip ? 'has-chip' : ''} ${hasTrick ? 'has-trick' : ''} ${isOver ? 'over-trick' : ''}`}
          >
            {hasTrick && <div className="card-back-mini" style={{ transform: cardRot }} />}
            {hasChip && <div className="poker-chip" />}
            {!hasTrick && !hasChip && <div className="empty-pile" />}
            {hasTrick && trickCards && (
              <div className="trick-tooltip">
                <div className="tooltip-cards">
                  {trickCards.map((c) => (
                    <MiniCardFace key={c.id} card={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {overTricks > 0 && (
        <div className="over-label">+{overTricks}</div>
      )}
    </div>
  ) : null;

  return (
    <div className={`player-info player-${player.position}`}>
      {tracker}
      <div
        className={`player-avatar ${isActive ? 'active' : ''} ${isDealer ? 'dealer' : ''}`}
        style={{ backgroundColor: bgColor }}
      >
        {initial}
        {isDealer && <div className="dealer-marker">D</div>}
      </div>
      {!player.isHuman && (
        <div className="ai-phase-icons">
            {biddingPhase && (
              <div className="ai-phase-item" title={biddingPhase === 'neural'
                ? `Bidding NN: ${Math.round((biddingConfidence ?? 0) * 100)}% confident`
                : biddingPhase === 'shadow'
                  ? 'Bidding: shadow mode'
                  : 'Bidding: rule-based'
              }>
                <span className="ai-phase-label">B</span>
                <span className={`ai-phase-icon ai-phase-${biddingPhase}`}>
                  {biddingPhase === 'neural' ? '\uD83E\uDDE0' : biddingPhase === 'shadow' ? '\uD83D\uDC41' : '\u2699\uFE0F'}
                </span>
              </div>
            )}
            {cardPlayPhase && (
              <div className="ai-phase-item" title={cardPlayPhase === 'neural'
                ? `Card play NN: ${Math.round((cardPlayConfidence ?? 0) * 100)}% confident`
                : cardPlayPhase === 'shadow'
                  ? 'Card play: shadow mode'
                  : 'Card play: rule-based'
              }>
                <span className="ai-phase-label">P</span>
                <span className={`ai-phase-icon ai-phase-${cardPlayPhase}`}>
                  {cardPlayPhase === 'neural' ? '\uD83E\uDDE0' : cardPlayPhase === 'shadow' ? '\uD83D\uDC41' : '\u2699\uFE0F'}
                </span>
              </div>
            )}
          </div>
        )}
      <div className="player-name">{player.name}</div>
    </div>
  );
}
