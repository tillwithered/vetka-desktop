import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from '@/renderer/features/home/home-page';

describe('HomePage', () => {
  it('shows operational counters and an add action for an empty workspace', async () => {
    window.vetka.dolls.list = vi.fn(async () => ({ ok: true as const, data: [] }));
    render(<QueryClientProvider client={new QueryClient()}><HomePage /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Избранное' })).toBeInTheDocument();
    expect(screen.getByText('Избранных кукол')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Добавить куклу' })).toBeInTheDocument();
  });
});
