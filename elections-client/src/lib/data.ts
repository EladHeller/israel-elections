export const LATEST_ELECTION_ID = 25;

export const detectAvailableElections = async (
  max: number = LATEST_ELECTION_ID,
  min: number = 1,
): Promise<string[]> => {
  const available: string[] = [];
  for (let i = max; i >= min; i -= 1) {
    available.push(String(i));
  }
  return available;
};

export const fetchElectionResults = async <TResult = unknown>(
  electionId: string,
): Promise<TResult> => {
  const res = await fetch(`./data/${electionId}/allResults.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load data for election ${electionId}`);
  }
  return (res.json() as Promise<TResult>);
};

