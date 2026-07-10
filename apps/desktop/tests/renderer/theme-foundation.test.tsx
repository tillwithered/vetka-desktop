import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRendererFile = (file: string) => readFileSync(resolve(import.meta.dirname, '../../src', file), 'utf8');

describe('Maia/Violet renderer foundation', () => {
  it('uses Inter, semantic Violet chart tokens, and does not force dark mode', () => {
    const css = readRendererFile('index.css');
    const bootstrap = readRendererFile('renderer.tsx');

    expect(css).toContain('@fontsource-variable/inter');
    expect(css).toContain('--chart-1:');
    expect(css).toContain('--sidebar-primary:');
    expect(css).not.toContain('.dark {');
    expect(bootstrap).not.toContain("classList.add('dark')");
  });
});
