export const detectAvailableElections = async (max = 30, min = 1) => {
  const available = [];
  for (let i = max; i >= min; i -= 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`./data/${i}/allResults.json`, { cache: 'no-store' });
    if (res.ok) {
      available.push(String(i));
    }
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
