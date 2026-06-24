import { neon } from '@netlify/neon';
import { resetDb } from './db-bootstrap.js';

resetDb(neon())
  .then(() => {
    console.log('Reset DB store from seed data');
    console.log('Cleared DB magic-link tokens');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
