import { isMetered } from '../utils/text';

describe('isMetered', () => {
  it('returns false when meters are suspended', () => {
    expect(isMetered('Alternate side parking and meters are suspended for Christmas.')).toBe(false);
  });

  it('returns false when meters will be suspended', () => {
    expect(isMetered('Alternate side parking and meters will be suspended for Memorial Day.')).toBe(false);
  });

  it('returns false when meters are not in effect', () => {
    expect(isMetered('Alternate side parking and meters are not in effect today.')).toBe(false);
  });

  it('returns true when meters are in effect', () => {
    expect(isMetered('Alternate side parking and meters are in effect.')).toBe(true);
  });

  it('returns true when only alternate side parking is suspended and meters are in effect', () => {
    expect(isMetered('Alternate side parking is suspended for the holiday. Meters are in effect.')).toBe(true);
  });

  it('defaults to metered for empty or unrelated text', () => {
    expect(isMetered('')).toBe(true);
    expect(isMetered('Street cleaning schedule update.')).toBe(true);
  });
});
