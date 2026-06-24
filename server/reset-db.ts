import { resetDb } from './db-bootstrap.js';
import { createSqlClient } from './db-store.js';

resetDb(createSqlClient())
  .then(() => {
    console.log('Reset DB store from seed data');
    console.log('Cleared DB magic-link tokens');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
