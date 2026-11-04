import type { Answer, AnswerLink, QuestionContext, QuestionQuery } from './election-questions';
import { hasLocalityData } from './locality-availability';

// Use stable ballot IDs and actual route parameters, never names extracted from prose.
export function partyAnswerLink(party: string, context: QuestionContext, election: string, level?: 'localities' | 'stations'): AnswerLink {
  return hasLocalityData(election)
    ? { href: `/research/${election}?${new URLSearchParams({ party, ...(level ? { level } : {}) })}`, label: `לעמוד הרשימה ${context.names[party] ?? party}` }
    : { href: `/results/${election}`, label: `תוצאות הבחירות לכנסת ${election}` };
}

export function questionAnswerLinks(query: QuestionQuery, answer: Answer, context: QuestionContext, election: string): AnswerLink[] {
  const results = (id: string): AnswerLink => ({ href: `/results/${id}`, label: `תוצאות הבחירות לכנסת ${id}` });
  const parties = query.kind === 'results' ? query.parties
    : 'party' in query && query.party ? [query.party]
    : 'target' in query && query.target?.type === 'list' ? [query.target.id] : [];
  const links = parties.map(party => partyAnswerLink(party, context, election, 'level' in query ? query.level : undefined));
  // Geographic answers link each result in its own paragraph. Keep a general
  // destination as well for empty answers and national aggregates.
  if (!links.length && !answer.rowLinks?.some(row => row.length)) links.push(results(election));
  if (query.kind === 'comparison') links.push(results(query.source));
  return links.filter((link, index) => links.findIndex(other => other.href === link.href) === index);
}
