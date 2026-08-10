import { useReducer, useEffect, useCallback, useState, useRef } from 'react';
import {
  createInitialState,
  startRound,
  handleSelectTrump,
  handleBid,
  handlePlayCard,
  handleTrickPause,
  handleAIPlayer,
  handleContinueRound,
  buildAIContext,
} from './engine/game';
import { calculateBid, selectCard, getCardPlayRankings } from './engine/ai';
import { canPlayCard, compactCardDisplay } from './engine/wizard';
import { Hand } from './components/Hand';
import { Player } from './components/Player';
import { BrainPanel } from './components/BrainPanel';
import { TrickArea } from './components/TrickArea';
import { TrumpIndicator } from './components/TrumpIndicator';
import { TrumpSelector } from './components/TrumpSelector';
import { BidSelector } from './components/BidSelector';
import { Scoreboard } from './components/Scoreboard';
import { PersistentScoreboard } from './components/PersistentScoreboard';
import wizardImg from './assets/wizard.png';
import jesterImg from './assets/jester.png';
import './index.css';

interface TrickInsight {
  trickIndex: number;
  handAtStart: import('./types').Card[];
  tricksWonBefore: number;
  bid: number;
  cardsPlayedSoFar: import('./types').Card[];
  playersLeft: number;
  bestPlays: { card: import('./types').Card; score: number; willWin: boolean }[];
  chosenCard: import('./types').Card;
  completedTrick?: import('./types').Card[];
}

function MiniCardFace({ card }: { card: import('./types').Card }) {
  if (card.special === 'wizard') {
    return <div className="tooltip-card wizard"><img src={wizardImg} alt="W" className="tooltip-card-img" /></div>;
  }
  if (card.special === 'jester') {
    return <div className="tooltip-card jester"><img src={jesterImg} alt="J" className="tooltip-card-img" /></div>;
  }
  const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#d40000' : '#1a1a2e';
  const symbols: Record<string, string> = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
  return (
    <div className="tooltip-card face" style={{ color }}>
      <span>{card.rank}</span>
      <span>{symbols[card.suit!]}</span>
    </div>
  );
}

function App() {
  const [scoreboardMinimized, setScoreboardMinimized] = useState(false);
  const [aiHints, setAiHints] = useState<Record<number, {
    predictedBid?: number;
    chosenCard?: string;
    topStr?: string;
  }>>({});
  const [brainPanelPlayer, setBrainPanelPlayer] = useState<number | null>(null);
  const trickInsightsRef = useRef<Record<number, TrickInsight[]>>({});

  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof createInitialState>, action: { type: string; payload?: unknown }) => {
      switch (action.type) {
        case 'DEAL': return startRound(s);
        case 'SELECT_TRUMP': return handleSelectTrump(s, action.payload as import('./types').Suit);
        case 'BID': {
          const bid = action.payload as number;
          return handleBid(s, bid);
        }
        case 'PLAY': {
          const card = action.payload as import('./types').Card;
          return handlePlayCard(s, card);
        }
        case 'AI': return handleAIPlayer(s);
        case 'TRICK_PAUSE_DONE': return handleTrickPause(s);
        case 'CLEAR_DELAY': return { ...s, trickJustResolved: false };
        case 'CONTINUE': {
          setScoreboardMinimized(false);
          return handleContinueRound(s);
        }
        case 'RESET': return createInitialState();
        default: return s;
      }
    },
    null,
    createInitialState
  );

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isAITurn = currentPlayer && !currentPlayer.isHuman && (state.phase === 'playing' || state.phase === 'bidding' || state.phase === 'trump-select');

  const isTrickPause = state.phase === 'trick-pause';
  const shouldDelayAI = isAITurn && state.trickJustResolved;

  useEffect(() => {
    if (state.phase === 'scoring') {
      setScoreboardMinimized(false);
    }
  }, [state.phase]);

  useEffect(() => {
    if (isTrickPause) {
      const timer = setTimeout(() => {
        dispatch({ type: 'TRICK_PAUSE_DONE' });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isTrickPause, state.tricksPlayed]);

  useEffect(() => {
    if (isAITurn && !shouldDelayAI) {
      const timer = setTimeout(() => {
        const cp = state.players[state.currentPlayerIndex];
        if (cp && !cp.isHuman) {
          const ctx = buildAIContext(state, state.currentPlayerIndex);

          if (state.phase === 'bidding') {
            const bid = calculateBid(cp.hand, ctx);
            setAiHints(prev => ({ ...prev, [cp.id]: { ...prev[cp.id], predictedBid: bid } }));
          } else if (state.phase === 'playing') {
            const card = selectCard(cp.hand, state.currentTrick, ctx);
            const rankings = getCardPlayRankings(cp.hand, state.currentTrick, ctx);
            const topStr = rankings.slice(0, 3).map((r, i) =>
              `  ${i + 1}. ${compactCardDisplay(r.card)} — ${(r.score * 100).toFixed(0)}%${r.willWin ? ' WIN' : ' lose'}`
            ).join('\n');
            setAiHints(prev => ({
              ...prev,
              [cp.id]: { ...prev[cp.id], chosenCard: compactCardDisplay(card), topStr },
            }));
            const playerInsights = trickInsightsRef.current[cp.id] ?? [];
            trickInsightsRef.current = {
              ...trickInsightsRef.current,
              [cp.id]: [...playerInsights, {
                trickIndex: state.tricksPlayed,
                handAtStart: [...cp.hand],
                tricksWonBefore: ctx.tricksWon,
                bid: ctx.bid,
                cardsPlayedSoFar: state.currentTrick.cards.map(tc => tc.card),
                playersLeft: 4 - state.currentTrick.cards.length - 1,
                bestPlays: rankings,
                chosenCard: card,
              }],
            };
          }
        }
        dispatch({ type: 'AI' });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, shouldDelayAI, state.currentPlayerIndex, state.phase]);

  useEffect(() => {
    if (shouldDelayAI) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_DELAY' });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [shouldDelayAI, state.tricksPlayed]);

  const handleCardClick = useCallback(
    (card: import('./types').Card) => {
      if (state.phase !== 'playing' || !currentPlayer?.isHuman) return;
      if (!canPlayCard(card, currentPlayer.hand, state.currentTrick.leadSuit, state.trumpSuit)) return;
      dispatch({ type: 'PLAY', payload: card });
    },
    [state.phase, state.currentTrick.leadSuit, state.trumpSuit, currentPlayer]
  );

  const playableIds = new Set<string>();
  if (state.phase === 'playing' && currentPlayer?.isHuman) {
    for (const card of currentPlayer.hand) {
      if (canPlayCard(card, currentPlayer.hand, state.currentTrick.leadSuit, state.trumpSuit)) {
        playableIds.add(card.id);
      }
    }
  }

  const playerPositions = Object.fromEntries(
    state.players.map(p => [p.id, p.position])
  ) as Record<number, import('./types').PlayerPosition>;

  const [currentInsightRound, setCurrentInsightRound] = useState(0);
  useEffect(() => {
    if (state.round !== currentInsightRound) {
      setCurrentInsightRound(state.round);
      trickInsightsRef.current = {};
    }
  }, [state.round]);

  return (
    <div className="game-table">
      <div className="game-header">
        <div className="game-title">Wizard</div>
        <div className="game-header-info">
          <span>Round {state.round}/15</span>
          {state.round > 0 && state.phase !== 'game-over' && (
            <button className="restart-btn" onClick={() => dispatch({ type: 'RESET' })}>
              Restart
            </button>
          )}
        </div>
      </div>

      {brainPanelPlayer !== null && (
        <BrainPanel
          player={state.players[brainPanelPlayer]}
          insights={trickInsightsRef.current[brainPanelPlayer] ?? []}
          defaultTab={state.tricksPlayed}
          onClose={() => setBrainPanelPlayer(null)}
        />
      )}

      <TrumpIndicator trumpSuit={state.trumpSuit} flippedCard={state.flippedCard} />

      {state.players.filter(p => p.position !== 'bottom').map((player) => (
        <Player
          key={player.id}
          player={player}
          isActive={state.currentPlayerIndex === player.id}
          isDealer={state.dealerIndex === player.id}
          predictedBid={aiHints[player.id]?.predictedBid}
          chosenCard={aiHints[player.id]?.chosenCard}
          top3Str={aiHints[player.id]?.topStr}
          onOpenBrainPanel={setBrainPanelPlayer}
        />
      ))}

      <TrickArea
        trick={state.currentTrick}
        trumpSuit={state.trumpSuit}
        playerPositions={playerPositions}
      />

      <div className="player-info player-bottom">
        {state.players[0]?.bid !== null && (
          <div className="trick-tracker">
            {state.players[0]?.bid === 0 ? (
              <>
                <div className="bid-zero">0</div>
                {Array.from({ length: state.players[0]?.tricksWon ?? 0 }).map((_, i) => {
                  const trickCards = state.players[0]?.tricks[i];
                  return (
                    <div key={i} className="trick-pile has-trick">
                      <div className="card-back-mini" style={{ transform: 'rotate(0deg)' }} />
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
              </>
            ) : Array.from({ length: Math.max(state.players[0]?.bid ?? 0, state.players[0]?.tricksWon ?? 0) }).map((_, i) => {
              const bidTokens = state.players[0]?.bid ?? 0;
              const wonTricks = state.players[0]?.tricksWon ?? 0;
              const hasChip = i < bidTokens;
              const hasTrick = i < wonTricks;
              const isOver = i >= bidTokens;
              const trickCards = state.players[0]?.tricks[i];
              return (
                <div
                  key={i}
                  className={`trick-pile ${hasChip ? 'has-chip' : ''} ${hasTrick ? 'has-trick' : ''} ${isOver ? 'over-trick' : ''}`}
                >
                  {hasTrick && <div className="card-back-mini" style={{ transform: 'rotate(0deg)' }} />}
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
          </div>
        )}
        <div className="player-name">
          {state.players[0]?.name}
          {state.dealerIndex === 0 && <div className="dealer-marker">D</div>}
        </div>
      </div>

      <Hand
        cards={state.players[0]?.hand ?? []}
        position="bottom"
        onCardClick={handleCardClick}
        playableIds={state.phase === 'playing' && currentPlayer?.isHuman ? playableIds : undefined}
      />

      {state.round > 0 && (
        <>
          <PersistentScoreboard players={state.players} />
        </>
      )}

      <div className="message-bar">{state.message}</div>

      {state.phase === 'waiting' && (
        <button className="deal-btn" onClick={() => dispatch({ type: 'DEAL' })}>
          Deal
        </button>
      )}

      {state.phase === 'trump-select' && currentPlayer?.isHuman && (
        <TrumpSelector
          onSelect={(suit) => dispatch({ type: 'SELECT_TRUMP', payload: suit })}
          availableSuits={
            [...new Set(
              currentPlayer.hand
                .filter(c => c.suit !== null && !c.special)
                .map(c => c.suit as import('./types').Suit)
            )]
          }
        />
      )}

      {state.phase === 'bidding' && currentPlayer?.isHuman && currentPlayer.bid === null && (
        <BidSelector
          maxBid={state.cardsPerPlayer}
          onSelect={(bid) => dispatch({ type: 'BID', payload: bid })}
        />
      )}

      {state.phase === 'scoring' && !scoreboardMinimized && (
        <Scoreboard
          players={state.players}
          round={state.round}
          scoreHistory={state.scoreHistory}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onMinimize={() => setScoreboardMinimized(true)}
        />
      )}

      {state.phase === 'scoring' && scoreboardMinimized && (
        <button
          className="scoreboard-restore-btn"
          onClick={() => setScoreboardMinimized(false)}
        >
          Show Scoreboard
        </button>
      )}

      {state.phase === 'game-over' && (
        <div className="game-over">
          <h1>Game Over!</h1>
          <h2>Final Scores</h2>
          <div className="final-scores">
            <table className="score-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {[...state.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => (
                    <tr key={p.id}>
                      <td>{i === 0 ? '\uD83C\uDFC6 ' : ''}{p.name}</td>
                      <td className={p.score >= 0 ? 'score-positive' : 'score-negative'}>
                        {p.score}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <button className="deal-btn" onClick={() => dispatch({ type: 'RESET' })}>
            New Game
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
