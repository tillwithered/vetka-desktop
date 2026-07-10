import { describe, expect, it } from 'vitest';

import { verifyReleaseVersion } from '../../scripts/verify-release-version.mjs';

describe('verifyReleaseVersion', () => {
  it('accepts an exact stable semantic version tag', () => {
    expect(verifyReleaseVersion('v1.0.0', '1.0.0')).toBe('1.0.0');
    expect(verifyReleaseVersion('v12.34.56', '12.34.56')).toBe('12.34.56');
  });

  it.each([
    ['1.0.0', '1.0.0'],
    ['v1.0', '1.0.0'],
    ['v1.0.0-beta.1', '1.0.0-beta.1'],
    ['v01.0.0', '01.0.0'],
    ['v1.0.0', '1.0.1'],
    ['v1.0.0', 'v1.0.0'],
  ])('rejects tag %s for package version %s', (tag, version) => {
    expect(() => verifyReleaseVersion(tag, version)).toThrow();
  });
});
