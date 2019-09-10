module.exports = {
  csvUrl: 'https://media22.bechirot.gov.il/files/expc.csv',
  bucket: 'israel-elections-1',
  region: 'eu-west-3',
  blockPercentage: 0.0325,
  notSumKeys: ['סמל ישוב', 'שם ישוב'],
  notPartiesKeys: ['סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים', 'כשרים'],
  agreements: [['שס', 'ג'], ['מחל', 'טב'], ['פה', 'ל'], ['מרצ', 'אמת'], ['כ', 'כף']],
};
