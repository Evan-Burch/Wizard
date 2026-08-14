import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Player as PlayerType, Card, WonTrick } from '../types';
import { SvgCard } from './SvgCard';
import { Card as CardView } from './Card';
import { slideInWonStack, pulseBid } from '../lib/animation';
import { getPlayerLayout, computeFan, PlayerLayout } from '../lib/playerLayout';
import wizardImg from '../assets/wizard.png';
import jesterImg from '../assets/jester.png';
import wizardHatImg from '../assets/WizardHat.svg';
import avatarYou from '../assets/avatars/avatar-you.svg';
import avatarMike from '../assets/avatars/avatar-mike.svg';
import avatarLisa from '../assets/avatars/avatar-lisa.svg';
import avatarBill from '../assets/avatars/avatar-bill.svg';

const AVATARS = [avatarYou, avatarMike, avatarLisa, avatarBill];

interface PlayerProps {
  player: PlayerType;
  isActive: boolean;
  isDealer: boolean;
  cardsPerPlayer: number;
  tricksPlayed: number;
  insightsEnabled: boolean;
  onOpenBrainPanel?: (playerId: number) => void;
  onCardClick?: (card: Card) => void;
  playableIds?: Set<string>;
}

function MiniCardFace({ card, className }: { card: Card; className?: string }) {
  if (card.special === 'wizard') {
    return <img src={wizardImg} alt="W" className={`mini-face-img ${className ?? ''}`} />;
  }
  if (card.special === 'jester') {
    return <img src={jesterImg} alt="J" className={`mini-face-img ${className ?? ''}`} />;
  }
  return <SvgCard card={card} className={`mini-face-svg ${className ?? ''}`} />;
}

function WonTrickStack({ trick }: { trick: WonTrick }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (ref.current) slideInWonStack(ref.current);
  }, []);

  const { cards, winnerIndex } = trick;
  const mid = (cards.length - 1) / 2;

  const showTip = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const tipW = cards.length * 34 + 15;
    const tipH = 64;
    const placeBelow = rect.top < tipH + 12;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tipW - 6));
    const top = placeBelow ? rect.bottom + 8 : rect.top - tipH - 8;
    setTipPos({ top, left });
    setHover(true);
  };

  const hideTip = () => setHover(false);

  return (
    <>
      <div
        className="won-stack"
        ref={ref}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        tabIndex={-1}
      >
        {cards.map((c, i) => (
          <div
            key={c.id}
            className={`won-mini ${i === winnerIndex ? 'won-mini-winner' : ''}`}
            style={{
              zIndex: i === winnerIndex ? cards.length : i,
              transform: `translate(${(i - mid) * 3}px, ${(i - mid) * 2}px) rotate(${(i - mid) * 2.5}deg)`,
            }}
          >
            <MiniCardFace card={c} />
          </div>
        ))}
      </div>
      {hover && tipPos && createPortal(
        <div
          className="won-tooltip"
          style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {cards.map((c) => (
            <MiniCardFace key={c.id} card={c} className="won-tooltip-card" />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function SeatHand({
  player,
  layout,
  onCardClick,
  playableIds,
}: {
  player: PlayerType;
  layout: PlayerLayout;
  onCardClick?: (card: Card) => void;
  playableIds?: Set<string>;
}) {
  const count = player.hand.length;
  if (count === 0) return null;

  const { positions, size } = computeFan(layout, count);

  return (
    <div
      className={`seat-hand ${layout.interactive ? 'interactive' : ''}`}
      style={{ width: size.width, height: size.height }}
    >
      {player.hand.map((card, i) => {
        const p = positions[i];
        return (
          <div
            key={card.id}
            className="seat-fan-card"
            style={{
              transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
              zIndex: p.zIndex,
            }}
          >
            <CardView
              card={card}
              faceDown={!layout.faceUp}
              onClick={layout.interactive ? () => onCardClick?.(card) : undefined}
              disabled={layout.interactive && playableIds ? !playableIds.has(card.id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Player({
  player,
  isActive,
  isDealer,
  cardsPerPlayer,
  tricksPlayed,
  insightsEnabled,
  onOpenBrainPanel,
  onCardClick,
  playableIds,
}: PlayerProps) {
  const layout = getPlayerLayout(player.position, player.isHuman);
  const { id, name, bid, tricksWon, tricks, isHuman } = player;
  const avatar = AVATARS[id % AVATARS.length];

  const bidRef = useRef<HTMLDivElement>(null);
  const prevBid = useRef<number | null>(bid);

  useEffect(() => {
    if (bid !== null && bid !== prevBid.current && bidRef.current) {
      pulseBid(bidRef.current);
    }
    prevBid.current = bid;
  }, [bid]);

  const bidClass = useMemo(() => {
    if (bid === null) return '';
    const tricksLeft = Math.max(0, cardsPerPlayer - tricksPlayed);
    if (tricksWon > bid) return 'bid-red';
    if (tricksWon + tricksLeft < bid) return 'bid-red';
    if (bid === 0 || tricksWon === bid) return 'bid-green';
    return '';
  }, [bid, tricksWon, cardsPerPlayer, tricksPlayed]);

  const bidText = bid === null ? '' : `${tricksWon}/${bid}`;

  const stacks = tricks.map((t, i) => (
    <WonTrickStack key={i} trick={t} />
  ));

  const canClickAvatar = !isHuman && insightsEnabled;
  const avatarProps = canClickAvatar
    ? { onClick: () => onOpenBrainPanel?.(id), title: `${name} \u2014 AI decision insights` }
    : {};

  const avatarBlock = (
    <div className="flex flex-col items-center gap-[3px]">
      <div className="relative">
        <div
          className={`player-avatar ${isActive ? 'active' : ''} ${isDealer ? 'dealer' : ''} ${canClickAvatar ? 'clickable' : ''}`}
          {...avatarProps}
        >
          <img src={avatar} alt={name} className="player-avatar-img" />
          {isDealer && <img src={wizardHatImg} alt="Dealer" className="dealer-hat" />}
          {canClickAvatar && <div className="insights-badge" />}
        </div>
        {(bid !== null || tricks.length > 0) && (
          <div className={`avatar-bid-group bid-side-${layout.bidSide}`}>
            <div className={`bid-status ${bidClass}`} ref={bidRef}>{bidText}</div>
            <div className="tricks-stream">{stacks}</div>
          </div>
        )}
      </div>
      <div className="text-xs font-bold text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">{name}</div>
    </div>
  );

  const hand = (
    <SeatHand player={player} layout={layout} onCardClick={onCardClick} playableIds={playableIds} />
  );

  return (
    <div className="player-seat" style={{ ...layout.anchor, flexDirection: layout.direction }}>
      {layout.handSlot === 'start' && hand}
      {avatarBlock}
      {layout.handSlot === 'end' && hand}
    </div>
  );
}
