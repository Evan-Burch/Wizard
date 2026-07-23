import { useState, useEffect } from 'react';
import { TrainingDataStore } from '../engine/ai-tf/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  store: TrainingDataStore;
  onReset: () => void;
}

export function DataInfoDialog({ isOpen, onClose, store, onReset }: Props) {
  const [data, setData] = useState<TrainingDataStore>(store);

  useEffect(() => {
    setData(store);
  }, [store]);

  if (!isOpen) return null;

  const bidHuman = data.bidSamples.filter(s => s.isHuman).length;
  const bidAI = data.bidSamples.filter(s => !s.isHuman).length;
  const playHuman = data.playSamples.filter(s => s.isHuman).length;
  const playAI = data.playSamples.filter(s => !s.isHuman).length;

  const rounds = new Set([
    ...data.bidSamples.map(s => s.gameRound),
    ...data.playSamples.map(s => s.gameRound),
  ]);

  return (
    <div className="data-info-overlay" onClick={onClose}>
      <div className="data-info-dialog" onClick={e => e.stopPropagation()}>
        <div className="data-info-header">
          <h3>Training Data</h3>
          <button className="data-info-close" onClick={onClose}>×</button>
        </div>
        <div className="data-info-body">
          <div className="data-info-row">
            <span className="data-info-label">Rounds stored</span>
            <span className="data-info-value">{rounds.size}</span>
          </div>
          <div className="data-info-row">
            <span className="data-info-label">Total games played</span>
            <span className="data-info-value">{data.totalGamesPlayed}</span>
          </div>
          <div className="data-info-divider" />
          <div className="data-info-row">
            <span className="data-info-label">Bid samples</span>
            <span className="data-info-value">{data.bidSamples.length}</span>
          </div>
          <div className="data-info-subrow">
            <span className="data-info-label">Human</span>
            <span className="data-info-value">{bidHuman}</span>
          </div>
          <div className="data-info-subrow">
            <span className="data-info-label">AI</span>
            <span className="data-info-value">{bidAI}</span>
          </div>
          <div className="data-info-row">
            <span className="data-info-label">Play samples</span>
            <span className="data-info-value">{data.playSamples.length}</span>
          </div>
          <div className="data-info-subrow">
            <span className="data-info-label">Human</span>
            <span className="data-info-value">{playHuman}</span>
          </div>
          <div className="data-info-subrow">
            <span className="data-info-label">AI</span>
            <span className="data-info-value">{playAI}</span>
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
