import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RegionalOfferList } from '@/renderer/features/prices/regional-offer-list';
import type { RegionalPriceState } from '@/shared/contracts';

const base: Omit<RegionalPriceState, 'region' | 'status' | 'evidenceUrl'> = { asin: null, checkedAt: '2026-07-12T10:00:00.000Z', currentPrice: null, overdue: false };
const states: RegionalPriceState[] = [
  { ...base, region: 'amazon_us', status: 'verified', evidenceUrl: 'https://www.amazon.com/dp/B0CATPRICE1', asin: 'B0CATPRICE1', currentPrice: {
    listingId: 'l1', region: 'amazon_us', asin: 'B0CATPRICE1', url: 'https://www.amazon.com/dp/B0CATPRICE1', snapshotId: 's1', offerKind: 'regular',
    priceMinor: 2499, currency: 'USD', shippingMinor: null, sellerName: 'Amazon', fulfilledByAmazon: true,
    availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 500_000_000,
    priceKztMinor: 1_249_500, checkedAt: '2026-07-12T10:00:00.000Z', latestCheckStatus: 'verified',
  } },
  { ...base, region: 'amazon_uk', status: 'no_price', evidenceUrl: 'https://www.amazon.co.uk/dp/B0CATPRICE1' },
  { ...base, region: 'amazon_de', status: 'out_of_stock', evidenceUrl: 'https://www.amazon.de/dp/B0CATPRICE1' },
  { ...base, region: 'amazon_es', status: 'not_found', evidenceUrl: 'https://www.amazon.es/s?k=HXH76' },
  { ...base, region: 'amazon_it', status: 'blocked', evidenceUrl: 'https://www.amazon.it/s?k=HXH76', overdue: true },
];

describe('RegionalOfferList', () => {
  it('shows five auditable region states without presenting an old amount as current', () => {
    render(<RegionalOfferList states={states} />);
    for (const label of ['Amazon US', 'Amazon UK', 'Amazon DE', 'Amazon ES', 'Amazon IT']) expect(screen.getByText(label)).toBeInTheDocument();
    for (const label of ['Цена подтверждена', 'Сейчас без цены', 'Нет в наличии', 'Карточка не найдена', 'Не удалось проверить']) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByText(/24,99/)).toBeVisible();
    expect(screen.queryByText('18,96 $')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Открыть Amazon IT' })).toHaveAttribute('href', 'https://www.amazon.it/s?k=HXH76');
    expect(screen.getAllByText(/Проверено 12\.07\.2026/)).toHaveLength(5);
    expect(screen.getByText('Проверка просрочена')).toBeVisible();
    for (const oldLabel of ['Свежая', 'Давно', 'Устарела']) expect(screen.queryByText(oldLabel)).not.toBeInTheDocument();
  });

  it('shows explicit loading and error states', () => {
    const view = render(<RegionalOfferList states={[]} loading />);
    expect(screen.getByLabelText('Загрузка регионов Amazon')).toBeVisible();
    view.rerender(<RegionalOfferList states={[]} error />);
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить результаты Amazon');
  });
});
