const STORAGE_PREFIX = 'scenario-draft-v1';

const getStorageKey = (electionId: string): string => `${STORAGE_PREFIX}:${electionId}`;

const hasStorage = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.localStorage);

type DraftConfig = {
  algorithm: 'baderOffer' | 'ceilRound';
  blockPercentage: number;
  agreements: [string, string][];
};

export interface ScenarioDraft {
  config: DraftConfig | null;
  voteData: Record<string, { votes: number }>;
}

const sanitizeAgreements = (agreements: unknown): [string, string][] =>
  Array.isArray(agreements)
    ? (agreements as unknown[])
        .filter((pair) => Array.isArray(pair) && pair.length === 2)
        .map((pair) => {
          const [a, b] = pair as [unknown, unknown];
          return [String(a), String(b)];
        })
    : [];

const sanitizeAlgorithm = (
  value: unknown,
  fallback: DraftConfig['algorithm'] = 'baderOffer',
): DraftConfig['algorithm'] =>
  value === 'baderOffer' || value === 'ceilRound' ? value : fallback;

const sanitizeBlockPercentage = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const sanitizeVoteData = (value: unknown): Record<string, { votes: number }> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, any>).map(([party, data]) => {
      const votes = Number.parseInt(String((data as any)?.votes), 10);
      return [party, { votes: Number.isFinite(votes) && votes > 0 ? votes : 0 }];
    }),
  );
};

export const loadScenarioDraft = (electionId: string | null | undefined): ScenarioDraft | null => {
  if (!electionId || !hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(electionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const config =
      parsed.config && typeof parsed.config === 'object'
        ? {
            algorithm: sanitizeAlgorithm(parsed.config.algorithm, 'baderOffer'),
            blockPercentage: sanitizeBlockPercentage(
              parsed.config.blockPercentage,
              0.0325,
            ),
            agreements: sanitizeAgreements(parsed.config.agreements),
          }
        : null;
    const voteData = sanitizeVoteData(parsed.voteData);
    return { config, voteData };
  } catch {
    return null;
  }
};

export const saveScenarioDraft = (
  electionId: string | null | undefined,
  data: ScenarioDraft,
): void => {
  if (!electionId || !hasStorage()) return;
  try {
    window.localStorage.setItem(getStorageKey(electionId), JSON.stringify(data));
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
};

export const clearScenarioDraft = (electionId: string | null | undefined): void => {
  if (!electionId || !hasStorage()) return;
  try {
    window.localStorage.removeItem(getStorageKey(electionId));
  } catch {
    // Ignore storage availability failures.
  }
};

