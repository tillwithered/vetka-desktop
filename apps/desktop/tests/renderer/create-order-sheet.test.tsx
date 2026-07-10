import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CreateOrderSheet } from '@/renderer/features/orders/create-order-sheet';

describe('CreateOrderSheet', () => {
  it('uses a plain Telegram contact input and shows the selected offer read-only', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><CreateOrderSheet prices={[{ listingId: 'l1', region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', snapshotId: 's1', offerKind: 'regular', priceMinor: 2499, currency: 'USD', shippingMinor: 0, sellerName: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 514_200_000, priceKztMinor: 1_284_986, checkedAt: '2026-07-10T00:00:00Z', latestCheckStatus: 'verified' }]} /> </QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: 'Создать заказ' }));
    expect(screen.getByLabelText('Контакт клиента')).toHaveAttribute('placeholder', '@username или имя');
    expect(screen.getAllByText(/24,99/).length).toBeGreaterThan(0);
  });
});
