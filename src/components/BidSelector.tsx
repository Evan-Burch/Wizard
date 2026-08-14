interface BidSelectorProps {
  maxBid: number;
  onSelect: (bid: number) => void;
}

export function BidSelector({ maxBid, onSelect }: BidSelectorProps) {
  const bids = Array.from({ length: maxBid + 1 }, (_, i) => i);

  return (
    <div className="popup-panel absolute top-1/2 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 bg-white px-5 py-3">
      <label className="text-[13px] text-gray-900">Your bid:</label>
      <div className="flex flex-wrap justify-center gap-1.5">
        {bids.map((bid) => (
          <button
            key={bid}
            className="bid-btn"
            onClick={() => onSelect(bid)}
          >
            {bid}
          </button>
        ))}
      </div>
    </div>
  );
}
