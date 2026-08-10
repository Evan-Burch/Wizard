import { useState } from 'react';
import { Player as PlayerType, Card } from '../types';
import { getSuitSymbol } from '../engine/wizard';
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
    <div className="bp-overlay" onClick={onClose}>
      <div className="bp-panel" onClick={e => e.stopPropagation()}>
        <div className="bp-header">
          <h2 className="bp-title">{player.name} — Trick Insights</h2>
          <button className="bp-close" onClick={onClose}>×</button>
        </div>

        {insights.length === 0 ? (
          <div className="bp-empty">No data yet for this round.</div>
        ) : (
          <>
            <div className="bp-tab-bar">
              {Array.from({ length: maxTrick + 1 }).map((_, i) => (
                <button
                  key={i}
                  className={`bp-tab ${activeTab === i ? 'bp-tab-active' : ''}`}
                  onClick={() => setActiveTab(i)}
                >
                  Trick {i + 1}
                </button>
              ))}
            </div>

            {insight && (
              <div className="bp-content">
                <div className="bp-section">
                  <div className="bp-section-label">Hand at trick start:</div>
                  <div className="bp-card-row">
                    {insight.handAtStart.map(c => (
                      <MiniCard key={c.id} card={c} highlight={c.id === insight.chosenCard.id} />
                    ))}
                  </div>
                </div>

                <div className="bp-section">
                  <div className="bp-section-label">Tricks needed:</div>
                  <div className={`bp-value ${tricksNeeded < 0 ? 'bp-negative' : ''}`}>
                    {tricksNeededStr}
                  </div>
                </div>

                <div className="bp-section">
                  <div className="bp-section-label">Trick so far:</div>
                  <div className="bp-card-row">
                    {insight.cardsPlayedSoFar.map(c => (
                      <MiniCard key={c.id} card={c} />
                    ))}
                    {insight.cardsPlayedSoFar.length === 0 && (
                      <span className="bp-muted">No cards played yet (leading)</span>
                    )}
                  </div>
                </div>

                <div className="bp-section">
                  <div className="bp-section-label">Players left to play:</div>
                  <div className="bp-value">{insight.playersLeft}</div>
                </div>

                <div className="bp-section">
                  <div className="bp-section-label">Best plays:</div>
                  <div className="bp-choices">
                    {insight.bestPlays.map((tc, i) => {
                      const isChosen = tc.card.id === insight.chosenCard.id;
                      return (
                        <div key={i} className={`bp-choice ${isChosen ? 'bp-choice-chosen' : ''}`}>
                          <span className="bp-choice-rank">{i + 1}.</span>
                          <MiniCard card={tc.card} />
                          <span className="bp-choice-score">
                            {(tc.score * 100).toFixed(0)}%
                          </span>
                          <span className={`bp-will-win ${tc.willWin ? 'bp-will-win-pos' : 'bp-will-win-neg'}`}>
                            {tc.willWin ? 'WINNING' : 'LOSING'}
                          </span>
                          {isChosen && <span className="bp-chosen-badge">chosen</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {insight.completedTrick && (
                  <div className="bp-section">
                    <div className="bp-section-label">Completed trick:</div>
                    <div className="bp-card-row">
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
