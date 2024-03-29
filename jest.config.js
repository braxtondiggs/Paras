// base config from jest-present-angular
const jestPreset = require('jest-preset-angular/jest-preset');
const { globals } = jestPreset;
// set the correct path to the spect ts-config file
// the default for the jest-preset-angular package
// points to an incorrect path:
// <rootDir/src/tsconfig.spec.js
const tsjestOverrides = {
	tsconfig: '<rootDir>/tsconfig.spec.json'
};
const globalOverrides = {
	...globals
};
// make sure to add in the required preset and
// and setup file entries
module.exports = {
	...jestPreset,
	globals: { ...globalOverrides },
	preset: 'jest-preset-angular',
	setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
	verbose: true,
	collectCoverage: true
};
