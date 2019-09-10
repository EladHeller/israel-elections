/* eslint-disable no-undef */
import showSvg from './show-svg.js';

const dataPath = {
  results: 'results.json',
  resultsWithoutAgreements: 'resultsWithoutAgremments.json',
  beforeBaderOffer: 'beforeBaderOffer.json',
};

const onError = (e) => {
  console.error(e);
  d3.select('h1').style('color', 'red').text('שגיאה בהבאת הנתונים');
};

const loadResults = path => fetch(`https://israel-elections-1.s3.eu-west-3.amazonaws.com/2019_2/${path}`)
  .then(res => res.json())
  .then(showSvg)
  .catch(onError);

d3.select('select').on('change', function onChange() {
  loadResults(dataPath[this.value]);
});

loadResults(dataPath.results);
