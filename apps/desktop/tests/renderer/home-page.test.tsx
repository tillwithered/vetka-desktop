import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { HomePage } from '@/renderer/features/home/home-page';
import type { CurrentPrice, Doll } from '@/shared/contracts';

const doll: Doll = { id: 'favorite-1', name: 'Робекка Стим', characterName: null, lineName: 'Boo-riginal Creeproduction', generation: null, mattelSku: 'JHK59', officialName: null, mattelUrl: null, upcEan: null, imagePath: null, imageSource: null, notes: null, isFavorite: true, createdAt: '', updatedAt: '' };
const stalePrice: CurrentPrice = { listingId: 'listing-1', region: 'amazon_uk', asin: 'B0FK1V67X5', url: 'https://www.amazon.co.uk/dp/B0FK1V67X5', snapshotId: 'snapshot-1', offerKind: 'regular', priceMinor: 1999, currency: 'GBP', shippingMinor: null, sellerName: null, fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 650_000_000, priceKztMinor: 12_993_500, checkedAt: '2020-01-01T00:00:00.000Z', latestCheckStatus: 'verified' };

describe('HomePage', () => {
  afterEach(cleanup);

  it('shows a compact working-list empty state and add action', async () => {
    window.vetka.dolls.list = vi.fn(async () => ({ ok: true as const, data: [] }));
    render(<QueryClientProvider client={new QueryClient()}><HomePage /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Избранное' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Избранное пока пусто' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить куклу' }).length).toBeGreaterThan(0);
  });

  it('counts favorite dolls with stale prices instead of showing a hard-coded zero', async () => {
    window.vetka.dolls.list = vi.fn(async () => ({ ok: true as const, data: [doll] }));
    window.vetka.prices.current = vi.fn(async () => ({ ok: true as const, data: [stalePrice] }));

    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><HomePage /></QueryClientProvider></MemoryRouter>);

    expect(await screen.findByText('Нет цены или данные старше суток')).toBeInTheDocument();
    expect(screen.getByText('Нужна проверка').parentElement).toHaveTextContent('1');
  });
});
