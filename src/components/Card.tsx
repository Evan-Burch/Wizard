import { Card as CardType } from '../types';
import { SvgCard } from './SvgCard';
import wizardImg from '../assets/wizard.png';
import jesterImg from '../assets/jester.png';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  faceDown?: boolean;
}

export function Card({ card, onClick, selected, disabled, small, faceDown }: CardProps) {
  if (faceDown) {
    return (
      <div className={`card card-back cursor-default ${small ? 'small' : ''}`} />
    );
  }

  const stateClass = `${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${small ? 'small' : ''}`;
  const cardClass = disabled ? 'cursor-not-allowed' : 'cursor-pointer';

  if (card.special === 'wizard') {
    return (
      <div
        className={`card wizard-card ${stateClass} ${cardClass}`}
        onClick={disabled ? undefined : onClick}
      >
        <img src={wizardImg} alt="Wizard" className="card-image" />
      </div>
    );
  }

  if (card.special === 'jester') {
    return (
      <div
        className={`card jester-card ${stateClass} ${cardClass}`}
        onClick={disabled ? undefined : onClick}
      >
        <img src={jesterImg} alt="Jester" className="card-image" />
      </div>
    );
  }

  return (
    <div
      className={`card svg-card ${stateClass} ${cardClass}`}
      onClick={disabled ? undefined : onClick}
    >
      <SvgCard card={card} className="card-svg" />
    </div>
  );
}
