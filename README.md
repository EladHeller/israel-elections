# API
## Results
### Vote data
GET  `https://israel-elections-1.s3.eu-west-3.amazonaws.com/2019_2/voteData.json`
### Real results
GET  `https://israel-elections-1.s3.eu-west-3.amazonaws.com/2019_2/results.json`
### Before bader offer
GET  `https://israel-elections-1.s3.eu-west-3.amazonaws.com/2019_2/beforeBaderOffer.json`
### Without agreements
GET  `https://israel-elections-1.s3.eu-west-3.amazonaws.com/2019_2/resultsWithoutAgremments.json`

## Calc
POST  `https://7xf5kfr3ga.execute-api.eu-west-3.amazonaws.com/prod/calc`
``` javascript
{
  voteData: {'א': {votes: 123}, 'ב': {votes: 546}},
  blockPercentage: 0.01, // Optional. Default 0.0325
  agreements: [['א', 'ב']], // Optional. Default - real agreements
}
```