import { useEffect, useRef, useState } from 'react';
import { Player as PlayerType, Card } from '../types';
import { getSuitSymbol } from '../engine/wizard';
import { animateOverlayIn, animatePopupIn } from '../lib/animation';
import wizardImg from '../assets/wizard.png';
import jesterImg from '../assets/jester.png';

interface TrickInsight {
  trickIndex: number;
  handAtStart: Card[];
  tricksWonBefore: number;
  bid: number;
  cardsPlayedSoFar: Card[];
  playersLeft: number;
  bestPlays: { card: Card; score: number; willWin: boolean }[];
  chosenCard: Card;
  completedTrick?: Card[];
}

interface Props {
  player: PlayerType;
  insights: TrickInsight[];
  defaultTab: number;
  onClose: () => void;
}

function MiniCard({ card, highlight }: { card: Card; highlight?: boolean }) {
  if (card.special === 'wizard') {
    return <div className={`bp-mini-card ${highlight ? 'bp-chosen' : ''}`}><img src={wizardImg} alt="W" className="bp-card-img" /></div>;
  }
  if (card.special === 'jester') {
    return <div className={`bp-mini-card ${highlight ? 'bp-chosen' : ''}`}><img src={jesterImg} alt="J" className="bp-card-img" /></div>;
  }
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? '#d40000' : '#ccc';
  return (
    <div className={`bp-mini-card ${highlight ? 'bp-chosen' : ''}`}>
      <span style={{ color }}>{card.rank}{getSuitSymbol(card.suit!)}</span>
    </div>
  );
}

export function BrainPanel({ player, insights, defaultTab, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (overlayRef.current) animateOverlayIn(overlayRef.current);
    if (panelRef.current) animatePopupIn(panelRef.current);
  }, []);

  const maxTrick = insights.length > 0 ? Math.max(...insights.map(i => i.trickIndex)) : 0;
  const initialTab = defaultTab > 0 && defaultTab <= maxTrick ? defaultTab : maxTrick;
  const [activeTab, setActiveTab] = useState(Math.max(0, initialTab));

  const insight = insights.find(i => i.trickIndex === activeTab);

  const tricksNeeded = insight ? insight.bid - insight.tricksWonBefore : 0;
  const tricksNeededStr = insight
    ? tricksNeeded > 0
      ? `+${tricksNeeded} (bid ${insight.bid}, won ${insight.tricksWonBefore})`
      : tricksNeeded === 0
        ? `0 (bid ${insight.bid}, won ${insight.tricksWonBefore})`
        : `${tricksNeeded} (bid ${insight.bid}, won ${insight.tricksWonBefore})`
    : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" ref={overlayRef} onClick={onClose}>
      <div className="popup-panel max-h-[90vh] w-[520px] max-w-[95vw] overflow-y-auto bg-white p-5" ref={panelRef} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-base font-bold text-gray-900">{player.name} — Trick Insights</h2>
          <button className="bp-close" onClick={onClose}>×</button>
        </div>

        {insights.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No data yet for this round.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-1">
              {Array.from({ length: maxTrick + 1 }).map((_, i) => (
                <button
                  key={i}
                  className={`cursor-pointer rounded border px-3 py-1.5 text-xs transition-all ${
                    activeTab === i
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab(i)}
                >
                  Trick {i + 1}
                </button>
              ))}
            </div>

            {insight && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Hand at trick start:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {insight.handAtStart.map(c => (
                      <MiniCard key={c.id} card={c} highlight={c.id === insight.chosenCard.id} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Tricks needed:</div>
                  <div className={`text-[13px] text-gray-800 ${tricksNeeded < 0 ? 'text-red-500' : ''}`}>
                    {tricksNeededStr}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Trick so far:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {insight.cardsPlayedSoFar.map(c => (
                      <MiniCard key={c.id} card={c} />
                    ))}
                    {insight.cardsPlayedSoFar.length === 0 && (
                      <span className="text-xs italic text-gray-300">No cards played yet (leading)</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Players left to play:</div>
                  <div className="text-[13px] text-gray-800">{insight.playersLeft}</div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Best plays:</div>
                  <div className="flex flex-col gap-1.5">
                    {insight.bestPlays.map((tc, i) => {
                      const isChosen = tc.card.id === insight.chosenCard.id;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2.5 rounded border px-2.5 py-1.5 ${
                            isChosen ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <span className="w-4 text-xs font-semibold text-gray-400">{i + 1}.</span>
                          <MiniCard card={tc.card} />
                          <span className="ml-auto text-xs font-semibold text-gray-500">
                            {(tc.score * 100).toFixed(0)}%
                          </span>
                          <span
                            className={`rounded px-1 py-px text-[10px] font-bold ${
                              tc.willWin
                                ? 'bg-green-100 text-green-600'
                                : 'bg-red-100 text-red-500'
                            }`}
                          >
                            {tc.willWin ? 'WINNING' : 'LOSING'}
                          </span>
                          {isChosen && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">chosen</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {insight.completedTrick && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Completed trick:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {insight.completedTrick.map(c => (
                        <MiniCard key={c.id} card={c} highlight={c.id === insight.chosenCard.id} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
