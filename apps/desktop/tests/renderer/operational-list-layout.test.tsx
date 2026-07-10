import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DollsPage } from '@/renderer/features/dolls/dolls-page';
import { OrdersPage } from '@/renderer/features/orders/orders-page';

function renderQuery(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

describe('operational list layouts', () => {
  it('provides an explicitly labelled bounded doll search toolbar', async () => {
    window.vetka.dolls.list = vi.fn(async () => ({ ok: true as const, data: [] }));
    renderQuery(<DollsPage />);
    expect(await screen.findByRole('textbox', { name: 'Поиск кукол' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Каталог пока пуст' })).toBeInTheDocument();
  });

  it('provides an explicitly labelled order search toolbar', async () => {
    window.vetka.orders.list = vi.fn(async () => ({ ok: true as const, data: [] }));
    renderQuery(<OrdersPage />);
    expect(await screen.findByRole('textbox', { name: 'Поиск заказов' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Заказов пока нет' })).toBeInTheDocument();
  });
});
