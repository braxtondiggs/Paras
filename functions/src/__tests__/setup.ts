// jest.config.js pins TZ=UTC (the Cloud Functions runtime) so date assertions don't depend on the host
if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'UTC') {
  throw new Error('functions tests must run with TZ=UTC; run them through jest.config.js');
}
