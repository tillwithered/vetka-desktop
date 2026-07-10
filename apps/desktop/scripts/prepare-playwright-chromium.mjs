import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const executable = chromium.executablePath();
if (!existsSync(executable)) throw new Error('Playwright Chromium is not installed. Run: npx playwright install chromium');
const browserRoot = path.dirname(path.dirname(executable));
const destination = path.resolve('resources/playwright-chromium');
rmSync(destination, { recursive: true, force: true });
mkdirSync(path.dirname(destination), { recursive: true });
cpSync(browserRoot, destination, { recursive: true });
writeFileSync(path.resolve('resources/playwright-chromium.json'), JSON.stringify({ executable: path.relative(browserRoot, executable).replaceAll('\\', '/') }));
