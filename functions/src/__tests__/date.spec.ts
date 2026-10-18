import { execFileSync } from 'child_process';
import path from 'path';

import { parseASPDate } from '../utils/date';

const DATE_MODULE = path.resolve(__dirname, '../utils/date.ts');

// jest.config.js pins TZ=UTC and process.env is sandboxed inside test files, so a different host
// timezone can only be exercised from a separate Node process. It loads date.ts via a TypeScript require hook.
const CHILD_SCRIPT = `
const fs = require('fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};
const { parseASPDate } = require(process.argv[1]);
process.stdout.write(JSON.stringify({
  offset: new Date(2026, 9, 15).getTimezoneOffset(),
  dates: process.argv.slice(2).map((id) => parseASPDate(id).toISOString()),
}));
`;

function parseInTimezone(tz: string, dateIds: string[]): { offset: number; dates: string[] } {
  const output = execFileSync(process.execPath, ['-e', CHILD_SCRIPT, DATE_MODULE, ...dateIds], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

describe('parseASPDate', () => {
  it('returns 05:00Z on the calendar day of the id', () => {
    expect(parseASPDate('20261015').toISOString()).toBe('2026-10-15T05:00:00.000Z');
  });

  it('keeps 05:00Z for winter dates (no America/New_York DST conversion)', () => {
    expect(parseASPDate('20260115').toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });

  it.each([
    ['Asia/Tokyo', -540],
    ['America/Los_Angeles', 420],
  ])('does not depend on the host timezone (%s)', (tz, expectedOffset) => {
    const result = parseInTimezone(tz, ['20261015', '20260115']);

    expect(result.offset).toBe(expectedOffset);
    expect(result.dates).toEqual(['2026-10-15T05:00:00.000Z', '2026-01-15T05:00:00.000Z']);
  }, 20000);
});
