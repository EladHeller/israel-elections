import convict from 'convict';
import electionsConfig from './config-elections.json';
import type { ElectionsConfig } from './types';

type EnvironmentConfig = {
  currElections: number;
  bucket: string;
  distributionID: string;
  region: string;
};

const configSchema = convict<EnvironmentConfig>({
  currElections: {
    default: 26,
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

type ServiceConfig = EnvironmentConfig & {
  electionsConfig: Record<string, ElectionsConfig>;
  notPartiesKeys: string[];
};

const config: ServiceConfig = {
  ...getProperties(),
  electionsConfig,
  notPartiesKeys: ['חיצוניות', 'קלפי אחרת', 'ברזל', 'ריכוז', 'שופט', 'קלפי', 'סמל ועדה', 'סמל ישוב', 'שם ישוב', 'בזב', 'מצביעים', 'פסולים',
    'כשרים', ' שם ישוב', 'כתובת', 'מספר קלפי', 'ת. עדכון', 'סמל קלפי', 'בז\'\'ב', 'נפה', 'פיצול', 'בוחרים', '﻿סמל ועדה'],
}
export default config;
