import configs from '../data/elections-config.json';
import names from '../data/party-names.json';
import blocs from '../data/blocs.json';
import manifests from '../data/elections-manifests.json';
import type { BlocsConfig, ElectionConfig, ElectionManifest, ElectionResultsPayload, PartyNames } from '../types';
import type { ElectionSnapshot } from './election-comparisons';
import { fetchElectionResults } from './data';

export async function loadComparisonElection(id: string, signal: AbortSignal): Promise<ElectionSnapshot> {
  const config = (configs as unknown as Record<string, ElectionConfig>)[id];
  const manifest = (manifests as Record<string, ElectionManifest>)[id];
  if (!config || (manifest && !['counting', 'final'].includes(manifest.phase))) throw new Error('אין נתוני תוצאות למערכת הבחירות המבוקשת.');
  let results: ElectionResultsPayload;
  try {
    results = await fetchElectionResults<ElectionResultsPayload>(id, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('לא הצלחתי לטעון את תוצאות מערכת הבחירות להשוואה. אפשר לנסות שוב.', { cause: error });
  }
  if (!results?.voteData || typeof results.voteData !== 'object' || Array.isArray(results.voteData)
    || Object.values(results.voteData).some(entry => !entry || !Number.isSafeInteger(entry.votes) || entry.votes < 0)) throw new Error('נתוני מערכת הבחירות להשוואה אינם תקינים.');
  return { id, config, votes: results.voteData, names: (names as Record<string, PartyNames>)[id] ?? {}, blocs: (blocs as Record<string, BlocsConfig>)[id] };
}
