import { TrainingStatus } from '../engine/ai-tf/pipeline';

interface TrainingBadgeProps {
  status: TrainingStatus;
  progress: number;
}

export function TrainingBadge({ status, progress }: TrainingBadgeProps) {
  if (status === 'idle') {
    return (
      <div className="training-badge training-idle">
        <span className="training-icon">&#129504;</span>
        <span>Gathering data...</span>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="training-badge training-loading">
        <span className="training-icon">&#9881;</span>
        <span>Loading model...</span>
      </div>
    );
  }

  if (status === 'training') {
    return (
      <div className="training-badge training-active">
        <span className="training-icon training-spin">&#129504;</span>
        <span>Training... {progress}%</span>
        <div className="training-progress-bar">
          <div className="training-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="training-badge training-ready">
      <span className="training-icon">&#10003;</span>
      <span>Model Ready</span>
    </div>
  );
}
