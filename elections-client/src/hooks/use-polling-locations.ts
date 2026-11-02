import { useEffect, useState } from 'react';
import type { PollingLocations } from '../lib/polling-locations';

const empty: PollingLocations = {};

export function usePollingLocations(election: string): PollingLocations {
  const [locations, setLocations] = useState(empty);
  useEffect(() => {
    if (election !== '26') return;
    let active = true;
    void import('../data/polling-locations-26.json').then(data => {
      if (active) setLocations(data.default);
    }).catch(() => { /* Results remain usable if the optional location chunk fails. */ });
    return () => { active = false; };
  }, [election]);
  return election === '26' ? locations : empty;
}
