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
let currResults;

const getCurrElection = () => document.querySelector('.select-elections > select').value;
const getCurrType = () => document.querySelector('.select-type > select').value;

const loadResults = elections => fetch(`https://israel-elections-1.s3.eu-west-3.amazonaws.com/${elections}/allResults.json`)
  .then(res => res.json())
  .then((res) => {
    currResults = res;
    showSvg(res, elections, getCurrType());
  })
  .catch(onError);


d3.select('.select-elections').on('change', () => {
  loadResults(getCurrElection());
});
d3.select('.select-type').on('change', () => {
  showSvg(currResults, getCurrElection(), getCurrType());
});


loadResults(getCurrElection());
