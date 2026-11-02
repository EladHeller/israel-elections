export type QuestionOutcome = 'answered' | 'unsupported' | 'empty' | 'failed' | 'cancelled';
export interface QuestionAttempt { id: string; election: string; question: string; outcome: QuestionOutcome }

/** Retry the same attempt ID: a lost response must not duplicate a question. */
export async function recordQuestion(attempt: QuestionAttempt): Promise<boolean> {
  for (let retry = 0; retry < 2; retry++) {
    try {
      const response = await fetch('/api/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt), keepalive: true, signal: AbortSignal.timeout(4000),
      });
      if (response.ok) return true;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) return false;
    } catch { /* Recording failure must not prevent a local answer. */ }
  }
  return false;
}
