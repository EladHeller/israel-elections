import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  baderOffer, calcMandats, calcVotesResults, ceilRound, convertToAgreements,
  filterNotPassBlockPersentage, splitAgreements, sumBy,
} from '../calc-elections';

describe('convertToAgreements', () => {
  it('should convert votes with agreements to agreemnts', () => {
    const res = convertToAgreements([['א', 'ב']], {
      א: {
        votes: 12345,
        mandats: 5,
      },
      ב: {
        votes: 54321,
        mandats: 25,
      },
      ג: {
        votes: 98765,
        mandats: 50,
      },
    });

    assert.deepEqual(res, {
      'א+ב': {
        votes: 66666,
        mandats: 30,
      },
      ג: {
        votes: 98765,
        mandats: 50,
      },
    });
  });

  it('should ignore agreement pairs when a party is missing', () => {
    const res = convertToAgreements([['a', 'b'], ['c', 'd']], {
      a: {
        votes: 12345,
        mandats: 5,
      },
      b: {
        votes: 54321,
        mandats: 25,
      },
      c: {
        votes: 98765,
        mandats: 50,
      },
    });

    assert.deepEqual(res, {
      'a+b': {
        votes: 66666,
        mandats: 30,
      },
      c: {
        votes: 98765,
        mandats: 50,
      },
    });
  });
});

describe('calcMandats', () => {
  it('should calculate mandats', () => {
    const res = calcMandats(10, {
      a: {
        votes: 360,
      },
      b: {
        votes: 640,
      },
    });

    assert.deepEqual(res, {
      a: {
        mandats: 3,
        votes: 360,
      },
      b: {
        mandats: 6,
        votes: 640,
      },
    });
  });
});

describe('baderOffer', () => {
  it('should calculate mandats with bader offer algorithm', () => {
    const res = baderOffer(20, {
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 640,
        mandats: 6,
      },
      c: {
        votes: 1000,
        mandats: 10,
      },
    });

    assert.deepEqual(res, {
      a: {
        mandats: 3,
        votes: 360,
      },
      b: {
        mandats: 7,
        votes: 640,
      },
      c: {
        votes: 1000,
        mandats: 10,
      },
    });
    assert.equal(sumBy(Object.values(res), 'mandats'), 20);
  });
});

describe('ceilRound', () => {
  it('should calculate with round up algorithm', () => {
    const res = ceilRound(20, {
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 640,
        mandats: 5,
      },
      c: {
        votes: 1000,
        mandats: 10,
      },
    });

    assert.deepEqual(res, {
      a: {
        votes: 360,
        mandats: 4,
      },
      b: {
        votes: 640,
        mandats: 6,
      },
      c: {
        votes: 1000,
        mandats: 10,
      },
    });
    assert.equal(sumBy(Object.values(res), 'mandats'), 20);
  });
});

describe('filterNotPassBlockPersentage', () => {
  it('should not filter parties if all pass block persentage', () => {
    const res = filterNotPassBlockPersentage(0.1, {
      a: {
        votes: 360,
      },
      b: {
        votes: 640,
      },
      c: {
        votes: 1000,
      },
    }, 2000);

    assert.deepEqual(res, {
      a: {
        votes: 360,
      },
      b: {
        votes: 640,
      },
      c: {
        votes: 1000,
      },
    });
  });

  it('should filter parties that not pass block persentage', () => {
    const res = filterNotPassBlockPersentage(0.2, {
      a: {
        votes: 360,
      },
      b: {
        votes: 640,
      },
      c: {
        votes: 1000,
      },
    }, 2000);

    assert.deepEqual(res, {
      b: {
        votes: 640,
      },
      c: {
        votes: 1000,
      },
    });
  });
});

describe('splitAgreements', () => {
  it('should split agreements when no calculation needed', () => {
    const res = splitAgreements({
      a: {
        votes: 640,
        mandats: 6,
      },
      b: {
        votes: 640,
        mandats: 6,
      },
      c: {
        votes: 320,
        mandats: 3,
      },
      d: {
        votes: 320,
        mandats: 3,
      },
    }, {
      a: {
        votes: 640,
        mandats: 6,
      },
      b: {
        votes: 640,
        mandats: 6,
      },
      'c+d': {
        votes: 640,
        mandats: 6,
      },
    });

    assert.deepEqual(res, {
      a: {
        votes: 640,
        mandats: 6,
      },
      b: {
        votes: 640,
        mandats: 6,
      },
      c: {
        votes: 320,
        mandats: 3,
      },
      d: {
        votes: 320,
        mandats: 3,
      },
    });
  });

  it('should split agreements when calculation needed with bader offer algorithm', () => {
    const res = splitAgreements({
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 1000,
        mandats: 10,
      },
      c: {
        votes: 230,
        mandats: 2,
      },
      d: {
        votes: 410,
        mandats: 4,
      },
    }, {
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 1000,
        mandats: 10,
      },
      'c+d': {
        votes: 640,
        mandats: 7,
      },
    });

    assert.deepEqual(res, {
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 1000,
        mandats: 10,
      },
      c: {
        votes: 230,
        mandats: 2,
      },
      d: {
        votes: 410,
        mandats: 5,
      },
    });
  });

  it('should split agreements when calculation needed with round up algorithm', () => {
    const res = splitAgreements({
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 1000,
        mandats: 10,
      },
      c: {
        votes: 230,
        mandats: 2,
      },
      d: {
        votes: 410,
        mandats: 4,
      },
    }, {
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 1000,
        mandats: 10,
      },
      'c+d': {
        votes: 640,
        mandats: 7,
      },
    }, ceilRound);

    assert.deepEqual(res, {
      a: {
        votes: 360,
        mandats: 3,
      },
      b: {
        votes: 1000,
        mandats: 10,
      },
      c: {
        votes: 230,
        mandats: 3,
      },
      d: {
        votes: 410,
        mandats: 4,
      },
    });
  });
});

describe('calcVotesResults', () => {
  it('should calculate votes results with bader offer algorithm', () => {
    const res = calcVotesResults(
      {
        a: {
          votes: 360,
        },
        b: {
          votes: 1000,
        },
        c: {
          votes: 230,
        },
        d: {
          votes: 410,
        },
        e: {
          votes: 100,
        },
      },
      0.1,
      [['c', 'd']],
      'baderOffer',
      20,
    );

    assert.deepEqual(res, {
      beforeBaderOffer: {
        a: {
          votes: 360,
          mandats: 4,
        },
        b: {
          votes: 1000,
          mandats: 10,
        },
        c: {
          votes: 230,
          mandats: 2,
        },
        d: {
          votes: 410,
          mandats: 4,
        },
      },
      realResults: {
        a: {
          votes: 360,
          mandats: 3,
        },
        b: {
          votes: 1000,
          mandats: 10,
        },
        c: {
          votes: 230,
          mandats: 2,
        },
        d: {
          votes: 410,
          mandats: 5,
        },
      },
      voteData: {
        a: {
          votes: 360,
        },
        b: {
          votes: 1000,
        },
        c: {
          votes: 230,
        },
        d: {
          votes: 410,
        },
        e: {
          votes: 100,
        },
      },
      withoutAgreements: {
        a: {
          votes: 360,
          mandats: 3,
        },
        b: {
          votes: 1000,
          mandats: 11,
        },
        c: {
          votes: 230,
          mandats: 2,
        },
        d: {
          votes: 410,
          mandats: 4,
        },
      },
    });
  });

  it('should calculate votes results with round up algorithm', () => {
    const res = calcVotesResults(
      {
        a: {
          votes: 360,
        },
        b: {
          votes: 1000,
        },
        c: {
          votes: 230,
        },
        d: {
          votes: 410,
        },
        e: {
          votes: 100,
        },
      },
      0.1,
      [['c', 'd']],
      'ceilRound',
      20,
    );

    assert.deepEqual(res, {
      realResults: {
        a: {
          votes: 360,
          mandats: 4,
        },
        b: {
          votes: 1000,
          mandats: 10,
        },
        c: {
          votes: 230,
          mandats: 2,
        },
        d: {
          votes: 410,
          mandats: 4,
        },
      },
      afterBaderOffer: {
        a: {
          votes: 360,
          mandats: 3,
        },
        b: {
          votes: 1000,
          mandats: 10,
        },
        c: {
          votes: 230,
          mandats: 2,
        },
        d: {
          votes: 410,
          mandats: 5,
        },
      },
      voteData: {
        a: {
          votes: 360,
        },
        b: {
          votes: 1000,
        },
        c: {
          votes: 230,
        },
        d: {
          votes: 410,
        },
        e: {
          votes: 100,
        },
      },
      withoutAgreements: {
        a: {
          votes: 360,
          mandats: 4,
        },
        b: {
          votes: 1000,
          mandats: 10,
        },
        c: {
          votes: 230,
          mandats: 2,
        },
        d: {
          votes: 410,
          mandats: 4,
        },
      },
    });
  });

  it('should return empty results for empty data', () => {
    const res = calcVotesResults({});

    assert.deepEqual(res, {
      realResults: {},
      beforeBaderOffer: {},
      voteData: {},
      withoutAgreements: {},
    });
  });
});

it('should sum by property', () => {
  const res = sumBy(
    [
      {
        a: 1,
        b: 2,
      },
      {
        a: 3,
        b: 4,
      },
      {
        a: 'qewqe',
        b: 6,
      },
    ],
    'a',
  );

  assert.equal(res, 4);
});
