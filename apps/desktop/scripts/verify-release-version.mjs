import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const STABLE_VERSION = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)';
const TAG_PATTERN = new RegExp(`^v${STABLE_VERSION}$`);
const PACKAGE_PATTERN = new RegExp(`^${STABLE_VERSION}$`);

export function verifyReleaseVersion(tag, packageVersion) {
  if (!TAG_PATTERN.test(tag)) {
    throw new Error(`Release tag must match vMAJOR.MINOR.PATCH; received ${tag || '<empty>'}`);
  }
  if (!PACKAGE_PATTERN.test(packageVersion)) {
    throw new Error(`Package version must be a stable semantic version; received ${packageVersion || '<empty>'}`);
  }
  const tagVersion = tag.slice(1);
  if (tagVersion !== packageVersion) {
    throw new Error(`Release tag ${tag} does not match package version ${packageVersion}`);
  }
  return tagVersion;
}

async function main() {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const version = verifyReleaseVersion(process.env.GITHUB_REF_NAME ?? '', packageJson.version);
  process.stdout.write(`Verified release version ${version}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
