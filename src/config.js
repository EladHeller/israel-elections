const {mergeEnv} = require('@welldone-software/env-config');

const config = {
  csvUrl: 'https://media22.bechirot.gov.il/files/expc.csv',
  elections: '22',
  bucket: 'israel-elections-1',
  region: 'eu-west-3',
  blockPercentage: 0.0325,
  notPartiesKeys: ['סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים', 'כשרים', ' שם ישוב', 'כתובת',
    'מספר קלפי', 'ת. עדכון', 'סמל קלפי', 'בז\'\'ב', 'נפה', 'פיצול', 'בוחרים', 'מצביעים'],
  agreements: [['שס', 'ג'], ['מחל', 'טב'], ['פה', 'ל'], ['מרצ', 'אמת'], ['כ', 'כף'],
    ['', ''], ['', ''], ['', ''], ['', ''], ['', '']],
};
mergeEnv(config);

module.exports = config;
