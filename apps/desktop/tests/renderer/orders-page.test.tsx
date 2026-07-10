import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OrdersPage } from '@/renderer/features/orders/orders-page';

describe('OrdersPage', () => {
  it('shows an operational empty state', async () => {
    window.vetka.orders.list = vi.fn(async () => ({ ok: true as const, data: [] }));
    render(<QueryClientProvider client={new QueryClient()}><OrdersPage /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Заказы' })).toBeInTheDocument();
    expect(await screen.findByText('Заказов пока нет')).toBeInTheDocument();
  });
});
