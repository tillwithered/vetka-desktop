import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/renderer/features/settings/settings-page';

describe('SettingsPage', () => {
  it('shows editable exchange rates and delivery defaults', async () => {
    window.vetka.settings.getAll = vi.fn(async () => ({ ok: true as const, data: {} }));
    render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getByLabelText('USD → KZT')).toBeInTheDocument();
    expect(screen.getByLabelText('Вес по умолчанию, г')).toBeInTheDocument();
  });
});
