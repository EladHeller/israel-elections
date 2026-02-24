export const LATEST_ELECTION_ID = 25;

export const detectAvailableElections = async (max = LATEST_ELECTION_ID, min = 1) => {
  const available = [];
  for (let i = max; i >= min; i -= 1) {
    available.push(String(i));
  }
  return available;
};

export const fetchElectionResults = async (electionId) => {
  const res = await fetch(`./data/${electionId}/allResults.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load data for election ${electionId}`);
  }
  return res.json();
};
