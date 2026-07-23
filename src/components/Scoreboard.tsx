import { Player, RoundScore } from '../types';

interface ScoreboardProps {
  players: Player[];
  round: number;
  scoreHistory: RoundScore[][];
  onContinue: () => void;
  onMinimize: () => void;
}

export function Scoreboard({ players, round, scoreHistory, onContinue, onMinimize }: ScoreboardProps) {
  const tableOrder = [0, 3, 2, 1];
  const ordered = tableOrder.map(i => players[i]);
  return (
    <div className="scoreboard">
      <button className="scoreboard-minimize-btn" onClick={onMinimize}>
        Minimize
      </button>
      <h2>Round {round} Complete</h2>
      <div className="score-sheet-wrapper">
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
                      <div className="cell-bid-taken">
                        <span>{entry.taken}</span>
                        <span className="cell-sep">/</span>
                        <span className={hit ? 'cell-hit' : ''}>{entry.bid}</span>
                      </div>
                      <div className={`cell-total ${entry.score >= 0 ? 'positive' : 'negative'}`}>
                        {entry.score >= 0 ? '+' : ''}{entry.score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="total-row">
              <td className="round-label total-label">Total</td>
              {ordered.map(p => {
                const total = scoreHistory[p.id]?.reduce((sum, e) => sum + e.score, 0) ?? 0;
                return (
                  <td key={p.id} className={`total-cell ${total >= 0 ? 'positive' : 'negative'}`}>
                    {total}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <button className="deal-btn" onClick={onContinue}>
        {round >= 15 ? 'See Final Scores' : 'Next Round'}
      </button>
    </div>
  );
}
