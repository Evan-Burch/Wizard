import { useEffect, useRef } from 'react';
import { Player, RoundScore } from '../types';
import { animateScoreboardIn } from '../lib/animation';

interface ScoreboardProps {
  players: Player[];
  round: number;
  scoreHistory: RoundScore[][];
  onContinue: () => void;
  onMinimize: () => void;
}

export function Scoreboard({ players, round, scoreHistory, onContinue, onMinimize }: ScoreboardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) animateScoreboardIn(ref.current);
  }, []);

  const tableOrder = players.length === 4 ? [0, 3, 2, 1] : players.map((_, i) => i);
  const ordered = tableOrder.map(i => players[i]);
  return (
    <div className="scoreboard fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/40" ref={ref}>
      <button
        className="absolute bottom-38 left-1/2 z-[51] -translate-x-1/2 cursor-pointer rounded border border-gray-400 bg-white px-4 py-1.5 text-sm font-bold text-gray-800 transition-all hover:bg-gray-100"
        onClick={onMinimize}
      >
        Minimize
      </button>
      <h2 className="mb-4 rounded bg-white px-6 py-2 text-2xl font-bold text-gray-900">Round {round} Complete</h2>
      <div className="mb-5 max-h-[60vh] overflow-auto rounded bg-white p-3">
        <table className="score-sheet">
          <thead>
            <tr>
              <th className="corner-cell"></th>
              {ordered.map(p => (
                <th key={p.id} className="player-col-header">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: round }).map((_, r) => (
              <tr key={r}>
                <td className="round-label">{r + 1}</td>
                {ordered.map(p => {
                  const entry = scoreHistory[p.id]?.[r];
                  if (!entry) return <td key={p.id} className="score-cell empty"></td>;
                  const hit = entry.bid === entry.taken;
                  return (
                    <td key={p.id} className="score-cell">
                      <div className="flex justify-center gap-0.5 text-[13px]">
                        <span>{entry.taken}</span>
                        <span className="opacity-40">/</span>
                        <span className={hit ? 'font-bold text-green-600' : ''}>{entry.bid}</span>
                      </div>
                      <div className={`mt-0.5 text-[11px] ${entry.score >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {entry.score >= 0 ? '+' : ''}{entry.score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="total-row">
              <td className="round-label total-label font-bold text-xs">Total</td>
              {ordered.map(p => {
                const total = scoreHistory[p.id]?.reduce((sum, e) => sum + e.score, 0) ?? 0;
                return (
                  <td key={p.id} className={`font-bold text-[15px] ${total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {total}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <button className="deal-btn absolute top-120 left-1/2 -translate-x-1/2 -translate-y-1/2" onClick={onContinue}>
        {round >= Math.floor(60 / players.length) ? 'See Final Scores' : 'Next Round'}
      </button>
    </div>
  );
}
