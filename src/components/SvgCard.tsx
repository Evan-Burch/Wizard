import { Card as CardType } from '../types';
import { cardSymbolId } from '../lib/cardSymbol';
import deckSvgRaw from '../assets/DeckCards.svg?raw';

let injected = false;

function ensureDeckDefs() {
  if (injected || typeof document === 'undefined') return;
  injected = true;

  const styleMatch = deckSvgRaw.match(/<style[^>]*>[\s\S]*?<\/style>/);
  const defsMatch = deckSvgRaw.match(/<defs[^>]*>[\s\S]*?<\/defs>/);
  const symbols = deckSvgRaw.match(/<symbol[^>]*>[\s\S]*?<\/symbol>/g) ?? [];

  const content = [styleMatch?.[0], defsMatch?.[0], ...symbols]
    .filter(Boolean)
    .join('')
    .replace(/xlink:href=/g, 'href=');

  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
  holder.innerHTML = content;
  document.body.appendChild(holder);
}

ensureDeckDefs();

interface SvgCardProps {
  card: CardType;
  className?: string;
}

export function SvgCard({ card, className }: SvgCardProps) {
  const id = cardSymbolId(card);
  if (!id) return null;
  return (
    <svg viewBox="0 0 140 190" className={className} role="img">
      <use href={`#${id}`} />
    </svg>
  );
}
