import type { Answer, QuestionContext } from './election-questions';
import { encodeSharedScenario } from './shared-scenario';
import type { VoteData } from '../types';

export async function questionScenarioHref(answer: Answer, context: QuestionContext, election: string): Promise<string | undefined> {
  if (!answer.scenario) return undefined;
  const withNames = (votes: VoteData): VoteData => Object.fromEntries(Object.entries(votes).map(([party, entry]) =>
    [party, { ...entry, name: context.names[party] ?? party }]));
  const token = await encodeSharedScenario({ version: 1, election, demo: false,
    base: { voteData: withNames(context.votes), config: context.config },
    scenario: { ...answer.scenario, voteData: withNames(answer.scenario.voteData) },
  });
  return `/simulator/${election}#scenario=${token}`;
}
