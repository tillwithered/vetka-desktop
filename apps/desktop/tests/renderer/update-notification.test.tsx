import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/renderer/app';

afterEach(cleanup);

describe('App updates', () => {
  it('does not mount an update banner when an update has been downloaded', async () => {
    window.vetka.updates.getState = vi.fn(async () => ({ ok: true as const, data: { status: 'downloaded' as const, version: '1.0.16' } }));

    render(<App />);

    expect(await screen.findByText('Vetka Desktop vtest')).toBeInTheDocument();
    expect(screen.queryByText('Обновление готово')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Перезапустить сейчас' })).not.toBeInTheDocument();
  });
});
