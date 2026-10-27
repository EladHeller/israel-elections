export interface SummaryRow {
  id: number;
  turnoutPercentage: number | null;
  totalVotes: number | null;
  invalidVotes: number | null;
  validVotes: number | null;
  thresholdPercentage: number | null;
  belowThresholdPercentage: number | null;
}

export type SummarySortKey = keyof SummaryRow;

export const sortSummaryRows = (rows: readonly SummaryRow[], key: SummarySortKey, direction: 'asc' | 'desc'): SummaryRow[] =>
  [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const hasLeft = left != null && Number.isFinite(left);
    const hasRight = right != null && Number.isFinite(right);
    if (hasLeft !== hasRight) return hasLeft ? -1 : 1;
    if (hasLeft && hasRight && left !== right) return (left! - right!) * (direction === 'asc' ? 1 : -1);
    return b.id - a.id;
  });
