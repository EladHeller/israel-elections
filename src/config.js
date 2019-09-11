const {mergeEnv} = require('@welldone-software/env-config');
const electionsConfig = require('./config-elections');

const config = {
  currElections: '22',
  electionsConfig,
  bucket: 'israel-elections-1',
  region: 'eu-west-3',
  notPartiesKeys: ['סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים', 'כשרים', ' שם ישוב', 'כתובת',
    'מספר קלפי', 'ת. עדכון', 'סמל קלפי', 'בז\'\'ב', 'נפה', 'פיצול', 'בוחרים', 'מצביעים'],
};
mergeEnv(config);

module.exports = config;
