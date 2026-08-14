import type { CSSProperties } from 'react';

export type FanAxis = 'horizontal' | 'vertical';

/**
 * Card sizing + fan rhythm. Change these once to resize/overlap every hand
 * the same way. `cardWidth/cardHeight` are the card dimensions; `spacing`
 * is the gap *between* card centers (smaller = more overlap). `fanBudget`
 * is the max total width/height a hand may span.
 */
export const CARD_CONFIG = {
  width: 69,
  height: 94,
  spacingMin: 8,
  spacingMax: 40,
  fanBudget: 460,
  rotationStep: 0, // 0 = straight cards, >0 fans them
  lift: 0,
};

export interface PlayerLayout {
  anchor: CSSProperties;
  direction: 'row' | 'column';
  handSlot: 'start' | 'end';
  bidSide: 'left' | 'right' | 'top' | 'bottom';
  fanAxis: FanAxis;
  cardWidth: number;
  cardHeight: number;
  spacingMin: number;
  spacingMax: number;
  fanBudget: number;
  baseRotation: number;
  rotationStep: number;
  lift: number;
  faceUp: boolean;
  interactive: boolean;
}

export interface FanPosition {
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
}

export interface FanSize {
  width: number;
  height: number;
}

export interface FanGeometry {
  positions: FanPosition[];
  size: FanSize;
}

interface SeatOverrides {
  anchor: CSSProperties;
  direction: 'row' | 'column';
  handSlot: 'start' | 'end';
  bidSide: 'left' | 'right' | 'top' | 'bottom';
  fanAxis: FanAxis;
  baseRotation: number;
  faceUp: boolean;
  interactive: boolean;
}

function seat(overrides: SeatOverrides): PlayerLayout {
  return {
    cardWidth: CARD_CONFIG.width,
    cardHeight: CARD_CONFIG.height,
    spacingMin: CARD_CONFIG.spacingMin,
    spacingMax: CARD_CONFIG.spacingMax,
    fanBudget: CARD_CONFIG.fanBudget,
    rotationStep: CARD_CONFIG.rotationStep,
    lift: CARD_CONFIG.lift,
    anchor: overrides.anchor,
    direction: overrides.direction,
    handSlot: overrides.handSlot,
    bidSide: overrides.bidSide,
    fanAxis: overrides.fanAxis,
    baseRotation: overrides.baseRotation,
    faceUp: overrides.faceUp,
    interactive: overrides.interactive,
  };
}

export function computeFan(layout: PlayerLayout, count: number): FanGeometry {
  const n = Math.max(0, count);
  const mid = (n - 1) / 2;
  const run = layout.fanAxis === 'horizontal' ? layout.cardWidth : layout.cardHeight;
  const spacing =
    n > 1
      ? Math.min(layout.spacingMax, Math.max(layout.spacingMin, (layout.fanBudget - run) / (n - 1)))
      : 0;

  const positions = Array.from({ length: n }, (_, i) => ({
    x: layout.fanAxis === 'horizontal' ? (i - mid) * spacing : 0,
    y: layout.fanAxis === 'horizontal' ? Math.abs(i - mid) * layout.lift : (i - mid) * spacing,
    rotation:
      layout.fanAxis === 'horizontal'
        ? (i - mid) * layout.rotationStep
        : layout.baseRotation + (i - mid) * layout.rotationStep,
    zIndex: i,
  }));

  const size =
    layout.fanAxis === 'horizontal'
      ? { width: layout.cardWidth + (n - 1) * spacing, height: layout.cardHeight }
      : { width: layout.cardHeight, height: layout.cardWidth + (n - 1) * spacing };

  return { positions, size };
}

export function getPlayerLayout(position: string, isHuman: boolean): PlayerLayout {
  if (isHuman) {
    return seat({
      anchor: { bottom: 12, left: '50%', transform: 'translateX(-50%)' },
      direction: 'column',
      handSlot: 'start',
      fanAxis: 'horizontal',
      baseRotation: 0,
      bidSide: 'left',
      faceUp: true,
      interactive: true,
    });
  }

  switch (position) {
    case 'top':
      return seat({
        anchor: { top: 10, left: '50%', transform: 'translateX(-50%)' },
        direction: 'column',
        handSlot: 'end',
        fanAxis: 'horizontal',
        baseRotation: 0,
        bidSide: 'right',
        faceUp: false,
        interactive: false,
      });
    case 'left':
      return seat({
        anchor: { left: 8, top: '50%', transform: 'translateY(-50%)' },
        direction: 'row',
        handSlot: 'end',
        fanAxis: 'vertical',
        baseRotation: 90,
        bidSide: 'top',
        faceUp: false,
        interactive: false,
      });
    case 'right':
      return seat({
        anchor: { right: 8, top: '50%', transform: 'translateY(-50%)' },
        direction: 'row',
        handSlot: 'start',
        fanAxis: 'vertical',
        baseRotation: -90,
        bidSide: 'bottom',
        faceUp: false,
        interactive: false,
      });
  }

  return seat({
    anchor: { bottom: 12, left: '50%', transform: 'translateX(-50%)' },
    direction: 'column',
    handSlot: 'start',
    fanAxis: 'horizontal',
    baseRotation: 0,
    bidSide: 'left',
    faceUp: true,
    interactive: false,
  });
}

export function seatCountPositions(seatCount: number): string[] {
  if (seatCount <= 1) return ['bottom'];
  if (seatCount === 4) return ['bottom', 'right', 'top', 'left'];
  return Array.from({ length: seatCount }, (_, i) => (i === 0 ? 'bottom' : `seat-${i}`));
}
