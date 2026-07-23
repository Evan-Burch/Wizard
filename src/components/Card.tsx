import { Card as CardType } from '../types';
import { getSuitSymbol, getSuitColor } from '../engine/wizard';
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
      <div
        className={`card card-back ${small ? 'small' : ''}`}
      />
    );
  }

  if (card.special === 'wizard') {
    return (
      <div
        className={`card wizard ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
      >
        <img src={wizardImg} alt="Wizard" className="card-image" />
      </div>
    );
  }

  if (card.special === 'jester') {
    return (
      <div
        className={`card jester ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
      >
        <img src={jesterImg} alt="Jester" className="card-image" />
      </div>
    );
  }

  const suitSymbol = getSuitSymbol(card.suit!);
  const color = getSuitColor(card.suit!);

  return (
    <div
      className={`card face ${color === '#d40000' ? 'red' : 'black'} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{ color }}
    >
      <div className="card-corner">
        <span>{card.rank}</span>
        <span>{suitSymbol}</span>
      </div>
      <div className="card-center">{suitSymbol}</div>
      <div className="card-corner-br">
        <span>{card.rank}</span>
        <span>{suitSymbol}</span>
      </div>
    </div>
  );
}
