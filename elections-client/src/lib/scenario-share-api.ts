import { validateSharedScenario, type SharedScenario } from './shared-scenario';

const ID_RE = /^[A-Za-z0-9_-]{10,43}$/;
const invalid = () => new Error('קישור התרחיש אינו תקין או שאינו נתמך.');

export async function createSharedScenario(snapshot: SharedScenario): Promise<string> {
  const scenario = validateSharedScenario(snapshot, snapshot.election);
  const response = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!response.ok) throw new Error('לא ניתן ליצור קישור לשיתוף.');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !ID_RE.test(value.id)) {
    throw new Error('לא ניתן ליצור קישור לשיתוף.');
  }
  return value.id;
}

export async function loadSharedScenario(id: string): Promise<SharedScenario> {
  if (!ID_RE.test(id)) throw invalid();
  const response = await fetch(`/api/scenarios/${encodeURIComponent(id)}`);
  if (!response.ok) throw invalid();
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !('election' in value) || typeof value.election !== 'string') throw invalid();
  return validateSharedScenario(value, value.election);
}
