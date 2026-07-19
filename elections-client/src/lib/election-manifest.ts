import type { ElectionManifest, ElectionPhase } from '../types';

export const phaseHasResults = (phase: ElectionPhase): boolean =>
  phase === 'counting' || phase === 'final';

export const getDefaultElectionId = (
  availableElections: string[],
  manifests: Record<string, ElectionManifest>,
): string | null =>
  availableElections.find(
    (electionId) => manifests[electionId]?.phase !== 'beforeLists',
  ) ?? availableElections[0] ?? null;

export const getElectionPhaseLabel = (
  manifest: ElectionManifest,
): string => {
  switch (manifest.phase) {
    case 'beforeLists':
      return 'הרשימות טרם נסגרו';
    case 'listsFinal':
      return 'הרשימות המתמודדות פורסמו';
    case 'voting':
      return 'הקלפיות פתוחות';
    case 'counting':
      return 'ספירת הקולות בעיצומה';
    case 'final':
      return 'תוצאות סופיות';
  }
};
