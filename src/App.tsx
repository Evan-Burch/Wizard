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
  collectAllCardsPlayed,
} from './engine/game';
import { predictBid } from './engine/ai-tf/bidding-model';
import { predictCard } from './engine/ai-tf/cardplay-model';
import { recordBidSample, recordPlaySample, clearRoundBuffer, getRoundBuffer, flushRoundSamples } from './engine/ai-tf/training';
import { resetAllSamples } from './engine/ai-tf/storage';
import { assignRoundRewards } from './engine/rewards';
import { canPlayCard } from './engine/wizard';
import { Hand } from './components/Hand';
import { Player } from './components/Player';
import { TrickArea } from './components/TrickArea';
import { TrumpIndicator } from './components/TrumpIndicator';
import { TrumpSelector } from './components/TrumpSelector';
import { BidSelector } from './components/BidSelector';
import { Scoreboard } from './components/Scoreboard';
import { PersistentScoreboard } from './components/PersistentScoreboard';
import { TrainingBadge } from './components/TrainingBadge';
import { DataInfoDialog } from './components/DataInfoDialog';
import { initializeModels, trainAfterRound, onTrainingStatusChange, determineAIPhase, TrainingStatus } from './engine/ai-tf/pipeline';
import wizardImg from './assets/wizard.png';
import jesterImg from './assets/jester.png';
import './index.css';

type PendingRecording =
  | { type: 'bid'; isHuman: boolean; hand: import('./types').Card[]; trumpSuit: import('./types').Suit | null; cardsPlayed: import('./types').Card[]; cardsPerPlayer: number; tricksPlayed: number; allBids: (number | null)[]; playerIndex: number; bid: number; round: number }
  | { type: 'play'; isHuman: boolean; hand: import('./types').Card[]; trick: import('./types').Trick; trumpSuit: import('./types').Suit | null; cardsPlayed: import('./types').Card[]; tricksPlayed: number; cardsPerPlayer: number; bid: number; tricksWon: number; allBids: (number | null)[]; allTricksWon: number[]; playerIndex: number; card: import('./types').Card; round: number }
  | null;

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
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>('loading');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [aiPhases, setAiPhases] = useState<Record<number, { phase: 'neural' | 'rule-based' | 'shadow'; confidence: number }>>({});
  const pendingRecording = useRef<PendingRecording>(null);
  const [dataInfoOpen, setDataInfoOpen] = useState(false);

  useEffect(() => {
    initializeModels();
    onTrainingStatusChange((status, progress) => {
      setTrainingStatus(status);
      setTrainingProgress(progress);
    });
  }, []);

  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof createInitialState>, action: { type: string; payload?: unknown }) => {
      switch (action.type) {
        case 'DEAL': return startRound(s);
        case 'SELECT_TRUMP': return handleSelectTrump(s, action.payload as import('./types').Suit);
        case 'BID': {
          const bid = action.payload as number;
          const player = s.players[s.currentPlayerIndex];
          if (player.isHuman) {
            pendingRecording.current = {
              type: 'bid',
              isHuman: true,
              hand: player.hand,
              trumpSuit: s.trumpSuit,
              cardsPlayed: collectAllCardsPlayed(s),
              cardsPerPlayer: s.cardsPerPlayer,
              tricksPlayed: s.tricksPlayed,
              allBids: s.players.map(p => p.bid),
              playerIndex: s.currentPlayerIndex,
              bid,
              round: s.round,
            };
          }
          return handleBid(s, bid);
        }
        case 'PLAY': {
          const card = action.payload as import('./types').Card;
          const player = s.players[s.currentPlayerIndex];
          if (player.isHuman) {
            const ctx = buildAIContext(s, s.currentPlayerIndex);
            pendingRecording.current = {
              type: 'play',
              isHuman: true,
              hand: player.hand,
              trick: s.currentTrick,
              trumpSuit: s.trumpSuit,
              cardsPlayed: collectAllCardsPlayed(s),
              tricksPlayed: s.tricksPlayed,
              cardsPerPlayer: s.cardsPerPlayer,
              bid: ctx.bid,
              tricksWon: ctx.tricksWon,
              allBids: ctx.allBids,
              allTricksWon: ctx.allTricksWon,
              playerIndex: s.currentPlayerIndex,
              card,
              round: s.round,
            };
          }
          return handlePlayCard(s, card);
        }
        case 'AI': return handleAIPlayer(s);
        case 'TRICK_PAUSE_DONE': return handleTrickPause(s);
        case 'CLEAR_DELAY': return { ...s, trickJustResolved: false };
        case 'CONTINUE': {
          setScoreboardMinimized(false);
          trainAfterRound();
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
      assignRoundRewards(state, getRoundBuffer());
      flushRoundSamples();
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
          const decisionType = state.phase === 'bidding' ? 'bidding' as const : 'playing' as const;
          setAiPhases(prev => ({
            ...prev,
            [cp.id]: determineAIPhase(cp.id, decisionType),
          }));

          if (state.phase === 'bidding') {
            const ctx = buildAIContext(state, state.currentPlayerIndex);
            const bid = predictBid(cp.hand, ctx);
            pendingRecording.current = {
              type: 'bid',
              isHuman: false,
              hand: cp.hand,
              trumpSuit: state.trumpSuit,
              cardsPlayed: collectAllCardsPlayed(state),
              cardsPerPlayer: state.cardsPerPlayer,
              tricksPlayed: state.tricksPlayed,
              allBids: state.players.map(p => p.bid),
              playerIndex: state.currentPlayerIndex,
              bid,
              round: state.round,
            };
          } else if (state.phase === 'playing') {
            const ctx = buildAIContext(state, state.currentPlayerIndex);
            const card = predictCard(cp.hand, state.currentTrick, ctx);
            pendingRecording.current = {
              type: 'play',
              isHuman: false,
              hand: cp.hand,
              trick: state.currentTrick,
              trumpSuit: state.trumpSuit,
              cardsPlayed: collectAllCardsPlayed(state),
              tricksPlayed: state.tricksPlayed,
              cardsPerPlayer: state.cardsPerPlayer,
              bid: ctx.bid,
              tricksWon: ctx.tricksWon,
              allBids: ctx.allBids,
              allTricksWon: ctx.allTricksWon,
              playerIndex: state.currentPlayerIndex,
              card,
              round: state.round,
            };
          }
        }
        dispatch({ type: 'AI' });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, shouldDelayAI, state.currentPlayerIndex, state.phase]);

  useEffect(() => {
    const recording = pendingRecording.current;
    if (recording) {
      pendingRecording.current = null;
      if (recording.type === 'bid') {
        recordBidSample(
          recording.hand, recording.trumpSuit,
          recording.cardsPlayed, recording.cardsPerPlayer,
          recording.tricksPlayed, recording.allBids,
          recording.playerIndex, recording.bid, recording.round, recording.isHuman
        );
      } else {
        recordPlaySample(
          recording.hand, recording.trick, recording.trumpSuit,
          recording.cardsPlayed, recording.tricksPlayed, recording.cardsPerPlayer,
          recording.bid, recording.tricksWon, recording.allBids, recording.allTricksWon,
          recording.playerIndex, recording.card, recording.round,
          recording.isHuman, recording.tricksPlayed
        );
      }
    }
  }, [state]);

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

  const handleResetData = useCallback(async () => {
    await resetAllSamples();
    clearRoundBuffer();
    window.location.reload();
  }, []);

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

      <button className="data-info-btn" onClick={() => setDataInfoOpen(true)}>i</button>

      <DataInfoDialog
        isOpen={dataInfoOpen}
        onClose={() => setDataInfoOpen(false)}
        roundBuffer={getRoundBuffer()}
        onReset={handleResetData}
      />

      <TrumpIndicator trumpSuit={state.trumpSuit} flippedCard={state.flippedCard} />

      {state.players.filter(p => p.position !== 'bottom').map((player) => (
        <Player
          key={player.id}
          player={player}
          isActive={state.currentPlayerIndex === player.id}
          isDealer={state.dealerIndex === player.id}
          aiPhase={aiPhases[player.id]?.phase}
          aiConfidence={aiPhases[player.id]?.confidence}
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
          <TrainingBadge status={trainingStatus} progress={trainingProgress} />
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
