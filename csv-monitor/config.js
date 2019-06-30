module.exports = {
  csvUrl: 'https://media21.bechirot.gov.il/files/expc.csv',
  bucket: 'israel-elections-1',
  region: 'eu-west-3',
  blockPercentage: 0.0325,
  notSumKeys: ['סמל ישוב', 'שם ישוב'],
  notPartiesKeys: ['סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים', 'כשרים'],
  agreements: [
    {a: 'שס', b: 'ג'},
    {a: 'מחל', b: 'טב'},
    {a: 'ן', b: 'ל'},
    {a: 'מרצ', b: 'אמת'},
    {a: 'דעם', b: 'ום'},
    {a: 'ףץ', b: 'ףז'},
  ],
};
