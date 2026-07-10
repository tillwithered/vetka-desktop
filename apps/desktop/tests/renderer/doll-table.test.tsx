import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DollTable } from '@/renderer/features/dolls/doll-table';

describe('DollTable', () => {
  it('renders identifiers and the favorite action', () => {
    render(<MemoryRouter><DollTable dolls={[{ id: 'd1', name: 'Draculaura', characterName: 'Draculaura', lineName: 'Core Refresh', generation: 'G3', mattelSku: 'HRP64', upcEan: null, imagePath: null, notes: null, isFavorite: true, createdAt: '', updatedAt: '' }]} pricesByDoll={{ d1: [{ listingId: 'l1', region: 'amazon_es', asin: 'B0CXYZ1234', url: 'https://amazon.es/dp/B0CXYZ1234', snapshotId: 's1', offerKind: 'regular', priceMinor: 3499, currency: 'EUR', shippingMinor: null, sellerName: null, fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 224_000_000, priceKztMinor: 783_776, checkedAt: '', latestCheckStatus: 'verified' }] }} onFavorite={vi.fn()} /></MemoryRouter>);
    expect(screen.getAllByText('Draculaura').length).toBeGreaterThan(0);
    expect(screen.getByText('HRP64')).toBeInTheDocument();
    expect(screen.getByText(/34,99.*ES/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
  });
});
