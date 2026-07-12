import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { FavoritePriceTable } from '@/renderer/features/home/favorite-price-table';
import type { Doll } from '@/shared/contracts';

const doll: Doll = { id: 'doll-1', name: 'Robecca Steam', characterName: null, lineName: 'Boo-riginal Creeproduction', generation: null, mattelSku: 'JHK59', officialName: null, mattelUrl: null, upcEan: null, imagePath: null, imageSource: null, notes: null, isFavorite: true, createdAt: '', updatedAt: '' };

afterEach(cleanup);

describe('Store-only price refresh actions', () => {
  it('refreshes the official Store catalog instead of running an individual Amazon search', async () => {
    const user = userEvent.setup();
    window.vetka.prices.current = vi.fn(async () => ({ ok: true as const, data: [] }));
    window.vetka.catalog.refreshNow = vi.fn(async () => ({ ok: true as const, data: { status: 'idle' as const, startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0 } }));
    window.vetka.amazon.refreshDoll = vi.fn(async () => ({ ok: true as const, data: { requestId: 'unexpected', regions: {} } }));
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><FavoritePriceTable dolls={[doll]} onFavorite={vi.fn()} /></QueryClientProvider></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Обновить цены' }));

    expect(window.vetka.catalog.refreshNow).toHaveBeenCalledTimes(1);
    expect(window.vetka.amazon.refreshDoll).not.toHaveBeenCalled();
  });
});
