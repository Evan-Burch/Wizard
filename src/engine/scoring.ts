export function calculateScore(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return 20 + (10 * bid);
  }
  const difference = Math.abs(bid - tricksWon);
  return -10 * difference;
}
