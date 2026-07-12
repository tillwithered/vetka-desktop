import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DollTable } from '@/renderer/features/dolls/doll-table';
import type { CurrentPrice, Doll } from '@/shared/contracts';

const doll: Doll = { id: 'd1', name: 'Draculaura', characterName: 'Draculaura', lineName: 'Core Refresh', generation: 'G3', mattelSku: 'HRP64', officialName: null, mattelUrl: null, upcEan: null, imagePath: null, imageSource: null, notes: null, isFavorite: true, createdAt: '', updatedAt: '' };
const price: CurrentPrice = { listingId: 'l1', region: 'amazon_es', asin: 'B0CXYZ1234', url: 'https://amazon.es/dp/B0CXYZ1234', snapshotId: 's1', offerKind: 'regular', priceMinor: 3499, currency: 'EUR', shippingMinor: null, sellerName: null, fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 224_000_000, priceKztMinor: 783_776, checkedAt: '', latestCheckStatus: 'verified' };

describe('DollTable', () => {
  it('renders a visual placeholder, identifiers, prices, and favorite action', () => {
    render(<MemoryRouter><DollTable dolls={[doll]} pricesByDoll={{ d1: [price] }} onFavorite={vi.fn()} /></MemoryRouter>);
    expect(screen.getByLabelText('Нет изображения')).toBeInTheDocument();
    expect(screen.getByText('HRP64')).toBeInTheDocument();
    expect(screen.getByText(/34,99.*ES/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
  });

  it('keeps long imported names inside the doll column with an ellipsis and full-name tooltip', () => {
    const longName = 'Monster High Frankie Stein Muñeca con Jersey Corto y Falda Negra de Piel sintética, con su Perrito Watzie y 7 Accesorios';
    render(<MemoryRouter><DollTable dolls={[{ ...doll, name: longName }]} onFavorite={vi.fn()} /></MemoryRouter>);

    const link = screen.getByRole('link', { name: longName });
    expect(link).toHaveAttribute('title', longName);
    expect(link).toHaveClass('truncate');
    expect(link.closest('table')).toHaveClass('table-fixed');
  });
});
