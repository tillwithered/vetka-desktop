import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CollectiblesPage } from '@/renderer/features/collectibles/collectibles-page';
import type { Collectible } from '@/shared/contracts';

const gozer: Collectible = {
  id: 'c1', mattelSku: 'JKM54', canonicalUrl: 'https://creations.mattel.com/products/gozer-jkm54',
  nameRu: 'Гозер — Skullector', officialName: 'Monster High Skullector Ghostbusters Gozer Doll',
  lineName: 'Skullector x Ghostbusters', priceMinor: 7000, currency: 'USD', lifecycle: 'in_stock',
  saleStartsAt: null, fangClubOnly: false, imageUrl: 'https://cdn.shopify.com/gozer.jpg',
  lastCheckResult: 'verified', lastCheckedAt: '2026-07-12T00:00:00.000Z', archivedAt: null,
  createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
};
const archived: Collectible = { ...gozer, id: 'c2', nameRu: 'Битлджус — Skullector', officialName: 'Monster High Beetlejuice Waiting Room 2-Pack', lifecycle: 'sold_out', archivedAt: '2026-07-12T00:00:00.000Z' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><CollectiblesPage /></MemoryRouter></QueryClientProvider>);
}

describe('CollectiblesPage', () => {
  it('shows active and archived collector dolls with direct Mattel actions', async () => {
    const list = vi.fn(async ({ archived: showArchived = false } = {}) => ({ ok: true as const, data: showArchived ? [archived] : [gozer] }));
    window.vetka = { ...window.vetka, collectibles: { ...window.vetka.collectibles, list } };
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Гозер — Skullector')).toBeVisible();
    expect(screen.getByText('В продаже')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Открыть на Mattel' })).toHaveAttribute('href', gozer.canonicalUrl);
    await user.click(screen.getByRole('tab', { name: 'Архив' }));
    expect(await screen.findByText('Битлджус — Skullector')).toBeVisible();
    expect(screen.getByText('Распродано')).toBeVisible();
  });

  it('shows stale product data and a persistent partial-refresh warning', async () => {
    window.vetka = {
      ...window.vetka,
      collectibles: {
        ...window.vetka.collectibles,
        list: async () => ({ ok: true, data: [{ ...gozer, lastCheckResult: 'error' }] }),
        getScanState: async () => ({ ok: true, data: { status: 'idle', startedAt: null, completedAt: '2026-07-12T00:00:00.000Z', nextRunAt: null, processed: 2, total: 3, lastError: '1 product checks failed' } }),
      },
    };

    renderPage();

    expect(await screen.findByText('Часть коллекционок не удалось проверить')).toBeVisible();
    expect(screen.getByText('Данные устарели')).toBeVisible();
    expect(screen.getByText('Гозер — Skullector')).toBeVisible();
  });
});
