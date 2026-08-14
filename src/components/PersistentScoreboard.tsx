import { Player } from '../types';

interface PersistentScoreboardProps {
  players: Player[];
}

export function PersistentScoreboard({ players }: PersistentScoreboardProps) {
  const tableOrder = players.length === 4 ? [0, 3, 2, 1] : players.map((_, i) => i);
  const ordered = tableOrder.map(i => players[i]);

  return (
    <div className="absolute right-2.5 bottom-2.5 z-[8] rounded bg-white px-2 py-0.5 text-xs text-black">
      <table className="border-collapse border border-black">
        <thead>
          <tr>
            <th className="px-1.5 py-0.5 text-[11px]">Player</th>
            <th className="px-1.5 py-0.5 text-[11px]">Score</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map(p => (
            <tr key={p.id}>
              <td className="px-1.5 py-0.5 text-[11px]">{p.name}</td>
              <td className="px-1.5 py-0.5 text-[11px] font-bold">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
