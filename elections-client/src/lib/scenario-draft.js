const STORAGE_PREFIX = 'scenario-draft-v1';

const getStorageKey = (electionId) => `${STORAGE_PREFIX}:${electionId}`;

const hasStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const sanitizeAgreements = (agreements) => (
  Array.isArray(agreements)
    ? agreements
      .filter((pair) => Array.isArray(pair) && pair.length === 2)
      .map(([a, b]) => [String(a), String(b)])
    : []
);

const sanitizeAlgorithm = (value, fallback = 'baderOffer') => (
  value === 'baderOffer' || value === 'ceilRound' ? value : fallback
);

const sanitizeBlockPercentage = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const sanitizeVoteData = (value) => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).map(([party, data]) => {
      const votes = Number.parseInt(data?.votes, 10);
      return [party, { votes: Number.isFinite(votes) && votes > 0 ? votes : 0 }];
    }),
  );
};

export const loadScenarioDraft = (electionId) => {
  if (!electionId || !hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(electionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const config = parsed.config && typeof parsed.config === 'object'
      ? {
        algorithm: sanitizeAlgorithm(parsed.config.algorithm, 'baderOffer'),
        blockPercentage: sanitizeBlockPercentage(parsed.config.blockPercentage, 0.0325),
        agreements: sanitizeAgreements(parsed.config.agreements),
      }
      : null;
    const voteData = sanitizeVoteData(parsed.voteData);
    return { config, voteData };
  } catch {
    return null;
  }
};

export const saveScenarioDraft = (electionId, data) => {
  if (!electionId || !hasStorage()) return;
  try {
    window.localStorage.setItem(getStorageKey(electionId), JSON.stringify(data));
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
};

export const clearScenarioDraft = (electionId) => {
  if (!electionId || !hasStorage()) return;
  try {
    window.localStorage.removeItem(getStorageKey(electionId));
  } catch {
    // Ignore storage availability failures.
  }
};
