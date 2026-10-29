// These elections have verified locality or polling-station CSVs in /data.
export const LOCALITY_ELECTIONS = Array.from({ length: 12 }, (_, i) => String(i + 15));
export const hasLocalityData = (election: string | null): boolean =>
  election !== null && LOCALITY_ELECTIONS.includes(election);

// Elections 15–19 already store station rows in the locality source.
export function pollingStationSource(election: string): string | null {
  if (!hasLocalityData(election)) return null;
  return `/data/${election}/${Number(election) <= 19 ? 'elections' : 'polling-stations'}.csv`;
}

export const hasEmbeddedPollingStations = (election: string): boolean =>
  hasLocalityData(election) && Number(election) <= 19;
