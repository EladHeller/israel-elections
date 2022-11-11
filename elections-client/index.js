import showSvg from './show-svg.js';

const selectType = d3.select('.select-type > select');
let currResults;

const onError = (e) => {
  d3.select('h1')
    .style('color', 'red')
    .style('display', 'block')
    .text('שגיאה בהבאת הנתונים');
  d3.select('svg')
    .html('');
  console.error(e);
};

const getCurrElection = () => document.querySelector('.select-elections > select').value;
const getCurrType = () => document.querySelector('.select-type > select').value;

const loadResults = async (elections) => {
  try {
    const res = await fetch(`/${elections}/allResults.json?v=${Math.random().toString()}`);
    if (res.ok) {
      currResults = await res.json();
      showSvg(currResults, elections, getCurrType());
    } else {
      onError(await res.text());
    }
  } catch (e) {
    onError(e);
  }
};

d3.select('.select-elections').on('change', () => {
  const elections = Number(getCurrElection());
  loadResults(elections);
  if (elections >= 8 || elections === 1) { // Bader offer
    selectType.html(`
        <option selected value="realResults">תוצאות אמת</option>
        <option value="beforeBaderOffer">תוצאות ללא בדר עופר</option>
        <option value="withoutAgreements">תוצאות ללא הסכמי עודפים</option>
    `);
  } else if (elections === 7) { // Old algorithm with agreements
    selectType.html(`
        <option selected value="realResults">תוצאות אמת</option>
        <option value="afterBaderOffer">תוצאות עם בדר עופר</option>
        <option value="withoutAgreements">תוצאות ללא הסכמי עודפים</option>
      `);
  } else if (elections < 8) { // Old algorithm without agreements
    selectType.html(`
        <option selected value="realResults">תוצאות אמת</option>
        <option value="afterBaderOffer">תוצאות עם בדר עופר</option>
      `);
  }
});
selectType.on('change', () => {
  showSvg(currResults, getCurrElection(), getCurrType());
});

loadResults(getCurrElection());
