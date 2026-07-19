import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getDefaultElectionId,
  getElectionPhaseLabel,
  phaseHasResults,
} from './election-manifest';

describe('election manifest', () => {
  it('requires result data only while counting and after results are final', () => {
    assert.equal(phaseHasResults('beforeLists'), false);
    assert.equal(phaseHasResults('listsFinal'), false);
    assert.equal(phaseHasResults('voting'), false);
    assert.equal(phaseHasResults('counting'), true);
    assert.equal(phaseHasResults('final'), true);
  });

  it('provides a public status label for every phase', () => {
    assert.equal(
      getElectionPhaseLabel({ phase: 'beforeLists', lists: [] }),
      'הרשימות טרם נסגרו',
    );
    assert.equal(
      getElectionPhaseLabel({ phase: 'listsFinal', lists: [] }),
      'הרשימות המתמודדות פורסמו',
    );
    assert.equal(
      getElectionPhaseLabel({ phase: 'voting', lists: [] }),
      'הקלפיות פתוחות',
    );
    assert.equal(
      getElectionPhaseLabel({ phase: 'counting', lists: [] }),
      'ספירת הקולות בעיצומה',
    );
    assert.equal(
      getElectionPhaseLabel({ phase: 'final', lists: [] }),
      'תוצאות סופיות',
    );
  });

  it('keeps the latest completed election selected until lists are final', () => {
    assert.equal(
      getDefaultElectionId(['26', '25'], {
        '26': { phase: 'beforeLists', lists: [] },
      }),
      '25',
    );
    assert.equal(
      getDefaultElectionId(['26', '25'], {
        '26': { phase: 'listsFinal', lists: [] },
      }),
      '26',
    );
    assert.equal(getDefaultElectionId([], {}), null);
  });
});
