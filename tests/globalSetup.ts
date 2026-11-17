import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

/**
 * Database-backed tests need MongoDB. Provide one of:
 *   - TEST_MONGO_URI  (e.g. a throw-away Atlas database; the tests drop their own collections), or
 *   - a machine that can run mongodb-memory-server (on Windows this needs the Visual C++ Redistributable).
 * If neither works, those tests are SKIPPED and reported as skipped — never silently passed.
 */
export async function setup() {
  if (process.env.TEST_MONGO_URI) return;
  try {
    mongod = await MongoMemoryServer.create();
    process.env.TEST_MONGO_URI = mongod.getUri();
  } catch (err) {
    process.env.TEST_DB_UNAVAILABLE = '1';
    // eslint-disable-next-line no-console
    console.warn(`\n⚠ No test database available — database-backed tests will be SKIPPED.\n  (${(err as Error).message.split('\n')[0]})\n`);
  }
}

export async function teardown() {
  await mongod?.stop();
}
