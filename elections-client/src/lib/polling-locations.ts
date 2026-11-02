import type { LocalityVotes } from './party-research';
import { localityId } from './locality-results';

export interface PollingLocation { name: string; address: string; lat: number; lon: number }
export type PollingLocations = Record<string, PollingLocation>;

export function findPollingLocation(locations: PollingLocations, row: LocalityVotes): PollingLocation | undefined {
  if (!row.pollingStation || !row.clusterCode) return undefined;
  return locations[`${localityId(row)}:${row.clusterCode}`];
}

export function locationMapLinks({ lat, lon }: PollingLocation) {
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${lon - .006},${lat - .004},${lon + .006},${lat + .004}&layer=mapnik&marker=${lat},${lon}`,
  };
}
