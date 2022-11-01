import convict from 'convict';
import electionsConfig from './config-elections';

const config = convict({
  currElections: {
    default: '25',
    env: 'CURR_ELECTIONS',
    format: 'nat',
  },
  bucket: {
    default: 'israel-elections-code-bucket',
    env: 'BUCKET',
    format: '*',
  },
  region: {
    default: 'eu-west-1',
    env: 'REGION',
    format: '*',
  },
});

export default {
  ...config.getProperties(),
  electionsConfig,
  notPartiesKeys: ['ברזל', 'ריכוז', 'שופט', 'קלפי', 'סמל ועדה', 'סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים',
    'כשרים', ' שם ישוב', 'כתובת', 'מספר קלפי', 'ת. עדכון', 'סמל קלפי', 'בז\'\'ב', 'נפה', 'פיצול', 'בוחרים', 'סמל ועדה'],
};
