import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_VIEW_MODE,
  selectViewData,
  viewUsesScenario,
} from './view-mode';

describe('view mode', () => {
  it('opens result data by default', () => {
    assert.equal(DEFAULT_VIEW_MODE, 'results');
  });

  it('uses scenario data only in the simulator', () => {
    assert.equal(selectViewData('results', 'official', 'edited'), 'official');
    assert.equal(selectViewData('summary', 'official', 'edited'), 'official');
    assert.equal(selectViewData('simulator', 'official', 'edited'), 'edited');
    assert.equal(viewUsesScenario('results'), false);
    assert.equal(viewUsesScenario('simulator'), true);
  });
});
