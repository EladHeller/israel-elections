import type { BlocsConfig } from '../types';

export const computeBlocOverview = (blocs: BlocsConfig, totals: Record<string, number>) => {
  const order = blocs.order || Object.keys(blocs.blocks);
  const primaryKeys = order.filter((key) => !blocs.blocks[key].complementaryTo);

  return primaryKeys.map((key) => {
    const complementaryKeys = order.filter((other) => blocs.blocks[other].complementaryTo === key);
    const ownSeats = totals[key] || 0;
    const combinedSeats = complementaryKeys.reduce((sum, other) => sum + (totals[other] || 0), ownSeats);
    const label = blocs.blocks[key].label;
    const complementLabel = complementaryKeys.map((other) => blocs.blocks[other].label).join(' ו');
    const majorityText = ownSeats >= 61
      ? `יש רוב ל${label}`
      : combinedSeats >= 61
        ? `יש רוב חוסם ל${label} בהסתמכות על ${complementLabel}`
        : `עוד ${61 - combinedSeats} ל${complementaryKeys.length ? 'רוב חוסם' : 'רוב'}`;

    return { key, complementaryKeys, ownSeats, combinedSeats, majorityText };
  });
};
