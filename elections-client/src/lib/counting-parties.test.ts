import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCountingParties, getPartyFilterState } from './counting-parties';

test('shows every registered party before results, even with an empty snapshot', () => {
  const lists = [{ ballotLetter: 'a', name: 'Alpha' }, { ballotLetter: 'b', name: 'Beta' }];
  assert.deepEqual(getCountingParties({}, {}, lists), [
    { party: 'a', votes: 0, mandats: 0 }, { party: 'b', votes: 0, mandats: 0 },
  ]);
});

test('first results hide non-qualifying parties by default and expose the show-all control', () => {
  assert.deepEqual(getPartyFilterState(false, true), { showAllParties: true, hidePartyFilter: true });
  assert.deepEqual(getPartyFilterState(false, false), { showAllParties: false, hidePartyFilter: false });
});

test('an explicit choice to show all parties is retained across live updates', () => {
  assert.deepEqual(getPartyFilterState(true, false), { showAllParties: true, hidePartyFilter: false });
  assert.deepEqual(getPartyFilterState(true, true), { showAllParties: true, hidePartyFilter: true });
  assert.deepEqual(getPartyFilterState(false, false), { showAllParties: false, hidePartyFilter: false });
});

test('keeps zero-vote parties during partial counting and excludes CSV metadata', () => {
  const votes = { a: { votes: 0, mandats: 0 }, b: { votes: 10, mandats: 0 },
    c: { votes: 20, mandats: 0 }, 'סמל ועדה': { votes: 0, mandats: 0 }, '﻿סמל ועדה': { votes: 0, mandats: 0 } };
  assert.deepEqual(getCountingParties(votes, { b: { votes: 10, mandats: 1 } }, [
    { ballotLetter: 'a', name: 'Alpha' }, { ballotLetter: 'b', name: 'Beta' },
  ]), [
    { party: 'b', votes: 10, mandats: 1 }, { party: 'c', votes: 20, mandats: 0 }, { party: 'a', votes: 0, mandats: 0 },
  ]);
});

