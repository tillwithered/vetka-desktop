import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from '@/renderer/features/home/home-page';

describe('HomePage', () => {
  it('shows a compact working-list empty state and add action', async () => {
    window.vetka.dolls.list = vi.fn(async () => ({ ok: true as const, data: [] }));
    render(<QueryClientProvider client={new QueryClient()}><HomePage /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Избранное' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Избранное пока пусто' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить куклу' }).length).toBeGreaterThan(0);
  });
});
