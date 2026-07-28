import { useState, useEffect } from 'react';
import { fetchSampleStats, TrainingSample } from '../engine/ai-tf/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roundBuffer: TrainingSample[];
  onReset: () => void;
}

export function DataInfoDialog({ isOpen, onClose, roundBuffer, onReset }: Props) {
  const [stats, setStats] = useState<{ bid: number; play: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSampleStats().then(setStats);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalBid = (stats?.bid ?? 0) + roundBuffer.filter(s => s.type === 'bid').length;
  const totalPlay = (stats?.play ?? 0) + roundBuffer.filter(s => s.type === 'play').length;

  return (
    <div className="data-info-overlay" onClick={onClose}>
      <div className="data-info-dialog" onClick={e => e.stopPropagation()}>
        <div className="data-info-header">
          <h3>Training Data</h3>
          <button className="data-info-close" onClick={onClose}>×</button>
        </div>
        <div className="data-info-body">
          <div className="data-info-row">
            <span className="data-info-label">Bid samples</span>
            <span className="data-info-value">{totalBid}</span>
          </div>
          <div className="data-info-row">
            <span className="data-info-label">Play samples</span>
            <span className="data-info-value">{totalPlay}</span>
          </div>
          <div className="data-info-divider" />
          <button className="data-info-reset-btn" onClick={onReset}>
            Erase All Data
          </button>
        </div>
      </div>
    </div>
  );
}
