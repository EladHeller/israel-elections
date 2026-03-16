import convict from 'convict';
import electionsConfig from './config-elections.json';
import type { ElectionsConfig } from './types';

const configSchema = convict({
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
  distributionID: {
    default: 'israel-elections-code-bucket',
    env: 'DISTRIBUTION_ID',
    format: '*',
  },
  region: {
    default: 'eu-west-1',
    env: 'REGION',
    format: '*',
  },
});

export const getProperties = () => configSchema.getProperties();

const properties = getProperties();
type ServiceConfig = {
  currElections: number,
  bucket: string,
  distributionID: string,
  region: string,
  electionsConfig: Record<string, ElectionsConfig>,
  notPartiesKeys: string[],
}

const config: ServiceConfig = {
  currElections: properties.currElections,
  bucket: properties.bucket,
  distributionID: properties.distributionID,
  region: properties.region,
  electionsConfig,
  notPartiesKeys: ['ברזל', 'ריכוז', 'שופט', 'קלפי', 'סמל ועדה', 'סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים',
    'כשרים', ' שם ישוב', 'כתובת', 'מספר קלפי', 'ת. עדכון', 'סמל קלפי', 'בז\'\'ב', 'נפה', 'פיצול', 'בוחרים', '﻿סמל ועדה'],
}
export default config;
