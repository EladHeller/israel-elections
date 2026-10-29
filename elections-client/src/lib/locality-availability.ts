// These elections have verified locality or polling-station CSVs in /data.
export const LOCALITY_ELECTIONS = Array.from({ length: 12 }, (_, i) => String(i + 15));
export const hasLocalityData = (election: string | null): boolean =>
  election !== null && LOCALITY_ELECTIONS.includes(election);
