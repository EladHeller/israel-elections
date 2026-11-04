import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completionCatalog } from './question-completion-catalog';

test('catalog keeps names and openings whole, compresses continuations and ignores unknown openings', () => {
  const branches = completionCatalog(['unsupported', 'כמה קולות קיבלה רשימה א?', 'כמה קולות קיבלה רשימה א?',
    'כמה קולות קיבלה רשימה אב?', 'השווה בין רשימה א לרשימה אב?',
    'מה היה קורה אם לא היה אחוז חסימה?', 'מה היה קורה אם לא היו הסכמי עודפים?'], ['רשימה א', 'רשימה אב']);
  const root = branches.find(branch => !branch.prefix)!;
  assert.deepEqual(root.children.map(child => child.label), ['כמה קולות קיבלה', 'השווה בין', 'מה היה קורה אם']);
  assert.deepEqual(branches.find(branch => branch.prefix === 'כמה קולות קיבלה')!.children.map(child => child.label), ['רשימה א', 'רשימה אב']);
  assert.ok(branches.some(branch => branch.prefix === 'השווה בין רשימה א' && branch.children[0].value.endsWith('לרשימה אב')));
  assert.ok(branches.some(branch => branch.children.some(child => child.label === 'היה אחוז חסימה')));
  assert.deepEqual(completionCatalog([], []), []);
  assert.ok(completionCatalog(['כמה קולות קיבלה אב'], []).length);
});
