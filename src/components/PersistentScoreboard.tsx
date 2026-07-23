import { Player } from '../types';

interface PersistentScoreboardProps {
  players: Player[];
}

export function PersistentScoreboard({ players }: PersistentScoreboardProps) {
  const tableOrder = [0, 3, 2, 1];
  const ordered = tableOrder.map(i => players[i]);

  return (
    <div className="persistent-scoreboard">
      <div className="psb-title">Score</div>
      {ordered.map(p => (
        <div key={p.id} className="psb-row">
          <span className="psb-name">{p.name}</span>
          <span className="psb-score">{p.score}</span>
        </div>
      ))}
    </div>
  );
}
