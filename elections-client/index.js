/* eslint-disable no-undef */
import showSvg from './show-svg.js';

fetch('https://israel-elections-1.s3.eu-west-3.amazonaws.com/2019_2/results.json')
  .then(res => res.json())
  .then(showSvg)
  .catch(() => {
    const loading = d3.select('h1');
    loading.style('color', 'red').text('שגיאה בהבאת הנתונים');
  });
