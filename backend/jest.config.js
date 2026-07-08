/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Integration tests need a live Postgres; unit tests do not. Both are matched
  // above — the integration file skips itself when TEST_DATABASE_URL is unset.
  moduleFileExtensions: ['ts', 'js', 'json'],
};
