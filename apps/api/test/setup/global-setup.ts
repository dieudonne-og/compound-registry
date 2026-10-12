import { resetDatabase } from '../../src/db/reset';
import { testConfig } from '../helpers';

export default async function setup() {
  await resetDatabase(testConfig(), { demo: false });
}
