interface PlayerCountSelectorProps {
  value: number;
  onChange: (count: number) => void;
  disabled: boolean;
}

const OPTIONS = [3, 4, 5, 6];

export function PlayerCountSelector({ value, onChange, disabled }: PlayerCountSelectorProps) {
  return (
    <div className="fixed top-8 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 shadow-md">
      <span className="mr-1 text-[11px] font-semibold text-gray-600">Players</span>
      {OPTIONS.map((count) => {
        const active = count === value;
        const enabled = count === 4;
        return (
          <button
            key={count}
            type="button"
            disabled={disabled || !enabled}
            onClick={() => onChange(count)}
            className={`h-7 w-7 cursor-pointer rounded-full text-xs font-bold transition-all ${
              active
                ? 'bg-[#00a000] text-white'
                : enabled
                  ? 'bg-white text-gray-800 hover:bg-gray-200'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
            title={enabled ? `${count} players` : `${count} players (coming soon)`}
          >
            {count}
          </button>
        );
      })}
    </div>
  );
}
