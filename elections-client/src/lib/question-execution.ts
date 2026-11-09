import type { QuestionContext, QuestionQuery } from './election-questions';
import { executeElectionQuestion } from './election-questions';
import { insightNeedsPlaces, type PreviousElection } from './question-insights';
import { hasLocalityData, pollingStationSource } from './locality-availability';
import { parseLocalities, parsePollingStations } from './party-research';
import partyNamesAll from '../data/party-names.json';
import type { ElectionSnapshot } from './election-comparisons';

export interface QuestionDataLoader {
  text: (path: string, failureMessage?: string) => Promise<string>;
  comparison: (id: string) => Promise<ElectionSnapshot>;
}

export async function executeQuestionWithData(query: QuestionQuery, context: QuestionContext, loader: QuestionDataLoader) {
  const electionId = context.electionId!;
  let places;
  if (query.kind === 'rank' || query.kind === 'below-threshold-winners' || insightNeedsPlaces(query)) {
    const stations = 'level' in query && query.level === 'stations';
    const source = stations ? pollingStationSource(electionId) : hasLocalityData(electionId) ? `/data/${electionId}/elections.csv` : null;
    if (!source) throw new Error('אין נתוני מקומות לבחירות אלו. אפשר לשאול על התוצאות הארציות או לבחור מערכת אחרת.');
    places = (stations ? parsePollingStations : parseLocalities)(await loader.text(source));
  }
  const comparison = (query.kind === 'comparison' || query.kind === 'comparison-scenario') && query.source
    ? await loader.comparison(query.source) : undefined;
  let previous: PreviousElection | undefined;
  if (query.kind === 'insight' && ['strengthened', 'weakened'].includes(query.metric)) {
    const id = String(Number(electionId) - 1);
    if (!hasLocalityData(id)) throw new Error('אין נתוני יישובים למערכת הבחירות הקודמת.');
    previous = { id, names: (partyNamesAll as Record<string, Record<string, string>>)[id] ?? {},
      places: parseLocalities(await loader.text(`/data/${id}/elections.csv`, 'לא הצלחתי לטעון את נתוני הבחירות הקודמות.')) };
  }
  return executeElectionQuestion(query, { ...context, previous, comparison }, places);
}
