interface BidSelectorProps {
  maxBid: number;
  onSelect: (bid: number) => void;
}

export function BidSelector({ maxBid, onSelect }: BidSelectorProps) {
  const bids = Array.from({ length: maxBid + 1 }, (_, i) => i);

  return (
    <div className="bid-selector">
      <label>Your bid:</label>
      <div className="bid-buttons">
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
