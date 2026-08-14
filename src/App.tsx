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
import { selectCard, getCardPlayRankings } from './engine/ai';
import { canPlayCard } from './engine/wizard';
import { maxRounds } from './engine/game';
import { Player } from './components/Player';
import { PlayerCountSelector } from './components/PlayerCountSelector';
import { BrainPanel } from './components/BrainPanel';
import { TrickArea } from './components/TrickArea';
import { TrumpIndicator } from './components/TrumpIndicator';
import { TrumpSelector } from './components/TrumpSelector';
import { BidSelector } from './components/BidSelector';
import { Scoreboard } from './components/Scoreboard';
import { PersistentScoreboard } from './components/PersistentScoreboard';
import { animateOverlayIn, animatePopupIn } from './lib/animation';
import gearImg from './assets/gear.svg';
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

const INSIGHTS_KEY = 'wizard.showInsights';

function App() {
  const [scoreboardMinimized, setScoreboardMinimized] = useState(false);
  const [brainPanelPlayer, setBrainPanelPlayer] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showInsights, setShowInsights] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INSIGHTS_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const trickInsightsRef = useRef<Record<number, TrickInsight[]>>({});
  const settingsOverlayRef = useRef<HTMLDivElement>(null);
  const settingsPopupRef = useRef<HTMLDivElement>(null);

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
        case 'SET_PLAYER_COUNT': {
          const count = action.payload as number;
          return createInitialState(count);
        }
        case 'RESET': return createInitialState(s.playerCount);
        default: return s;
      }
    },
    createInitialState()
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

          if (state.phase === 'playing') {
            const card = selectCard(cp.hand, state.currentTrick, ctx);
            const rankings = getCardPlayRankings(cp.hand, state.currentTrick, ctx);
            const playerInsights = trickInsightsRef.current[cp.id] ?? [];
            trickInsightsRef.current = {
              ...trickInsightsRef.current,
              [cp.id]: [...playerInsights, {
                trickIndex: state.tricksPlayed,
                handAtStart: [...cp.hand],
                tricksWonBefore: ctx.tricksWon,
                bid: ctx.bid,
                cardsPlayedSoFar: state.currentTrick.cards.map(tc => tc.card),
                playersLeft: state.players.length - state.currentTrick.cards.length - 1,
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

  useEffect(() => {
    if (settingsOpen) {
      if (settingsOverlayRef.current) animateOverlayIn(settingsOverlayRef.current);
      if (settingsPopupRef.current) animatePopupIn(settingsPopupRef.current);
    }
  }, [settingsOpen]);

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
  ) as Record<number, string>;

  const [currentInsightRound, setCurrentInsightRound] = useState(0);
  useEffect(() => {
    if (state.round !== currentInsightRound) {
      setCurrentInsightRound(state.round);
      trickInsightsRef.current = {};
    }
  }, [state.round]);

  const toggleInsights = (enabled: boolean) => {
    setShowInsights(enabled);
    try {
      localStorage.setItem(INSIGHTS_KEY, enabled ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="game-table">
      <div className="absolute top-1 left-1/2 z-[70] -translate-x-1/2 text-center">
        <div className="text-lg font-extrabold uppercase tracking-widest text-[#1a3a5c]">Wizard</div>
      </div>
      <PlayerCountSelector
        value={state.players.length}
        onChange={(count) => dispatch({ type: 'SET_PLAYER_COUNT', payload: count })}
        disabled={state.round > 0 && state.phase !== 'game-over'}
      />
      <div className="table-felt">
        <div className="absolute top-2.5 right-3 z-[30] flex items-center gap-3 rounded-full bg-white/95 px-4 py-1.5 text-xs text-[#1a3a5c] shadow-md">
          <span className="font-bold">Round {state.round}/{maxRounds(state.players.length)}</span>
          {state.round > 0 && state.phase !== 'game-over' && (
            <button
              className="cursor-pointer rounded-md border border-[#1a3a5c]/40 bg-white px-2.5 py-0.5 text-xs font-bold text-[#1a3a5c] transition-all hover:bg-red-100 hover:text-red-600"
              onClick={() => dispatch({ type: 'RESET' })}
            >
              Restart
            </button>
          )}
          <button
            className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full opacity-85 transition-all duration-300 hover:rotate-90 hover:opacity-100"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <img src={gearImg} alt="Settings" className="h-5 w-5" />
          </button>
        </div>

        {brainPanelPlayer !== null && (
          <BrainPanel
            player={state.players[brainPanelPlayer]}
            insights={trickInsightsRef.current[brainPanelPlayer] ?? []}
            defaultTab={state.tricksPlayed}
            onClose={() => setBrainPanelPlayer(null)}
          />
        )}

        {settingsOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
            ref={settingsOverlayRef}
            onClick={() => setSettingsOpen(false)}
          >
            <div
              className="popup-panel w-[400px] max-w-[92vw] bg-white p-5"
              ref={settingsPopupRef}
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="m-0 text-base font-bold text-gray-900">Settings</h2>
                <button className="bp-close" onClick={() => setSettingsOpen(false)}>×</button>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-gray-900">Show AI Decision Insights</span>
                  <span className="text-[11px] text-gray-500">Click an opponent's avatar to inspect their AI reasoning.</span>
                </div>
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] cursor-pointer accent-[#64b4ff]"
                  checked={showInsights}
                  onChange={e => toggleInsights(e.target.checked)}
                />
              </label>
            </div>
          </div>
        )}

        <TrumpIndicator trumpSuit={state.trumpSuit} flippedCard={state.flippedCard} />

        {state.players.map((player) => (
          <Player
            key={player.id}
            player={player}
            isActive={state.currentPlayerIndex === player.id}
            isDealer={state.dealerIndex === player.id}
            cardsPerPlayer={state.cardsPerPlayer}
            tricksPlayed={state.tricksPlayed}
            insightsEnabled={showInsights}
            onOpenBrainPanel={setBrainPanelPlayer}
            onCardClick={handleCardClick}
            playableIds={state.phase === 'playing' && currentPlayer?.isHuman ? playableIds : undefined}
          />
        ))}

        <TrickArea
          trick={state.currentTrick}
          trumpSuit={state.trumpSuit}
          playerPositions={playerPositions}
        />

        {state.round > 0 && (
          <PersistentScoreboard players={state.players} />
        )}

        <div className="absolute left-1/2 z-[5] -translate-x-1/2 rounded bg-[#edf35a] px-1.5 py-0.5 text-[12px] text-gray-800 whitespace-nowrap" style={{ top: '64%' }}>{state.message}</div>

        {state.phase === 'waiting' && (
          <button
            className="deal-btn absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            onClick={() => dispatch({ type: 'DEAL' })}
          >
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
            className="absolute bottom-33 left-1/2 z-40 -translate-x-1/2 cursor-pointer rounded border border-gray-400 bg-white px-4 py-1.5 text-sm font-bold text-gray-800 transition-all hover:bg-gray-100"
            onClick={() => setScoreboardMinimized(false)}
          >
            Show Scoreboard
          </button>
        )}

        {state.phase === 'game-over' && (
          <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/50">
            <h1 className="mb-2.5 text-[32px] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Game Over!</h1>
            <h2 className="mb-6 text-xl text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Final Scores</h2>
            <div className="mb-8">
              <table className="score-table">
                <thead>
                  <tr>
                    <th className="text-white">Player</th>
                    <th className="text-white">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-white">{i === 0 ? '\uD83C\uDFC6 ' : ''}{p.name}</td>
                        <td className={p.score >= 0 ? 'text-[#8dffa5]' : 'text-[#ff8a80]'}>
                          {p.score}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <button
              className="deal-btn absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
              onClick={() => dispatch({ type: 'RESET' })}
            >
              New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
