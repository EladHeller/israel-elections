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

const loadResults = (elections, file) => fetch(`https://israel-elections-1.s3.eu-west-3.amazonaws.com/${elections}/${file}`)
  .then(res => res.json())
  .then(res => showSvg(res, elections))
  .catch(onError);

const getCurrElection = () => document.querySelector('.select-elections > select').value;
const getCurrType = () => document.querySelector('.select-type > select').value;

d3.selectAll('select').on('change', () => {
  loadResults(getCurrElection(), dataPath[getCurrType()]);
});

loadResults(getCurrElection(), dataPath[getCurrType()]);
