import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/renderer/features/settings/settings-page';

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
}

describe('SettingsPage', () => {
  it('uses NBK auto mode by default and disables manual values', async () => {
    window.vetka.settings.getAll = vi.fn(async () => ({ ok: true as const, data: {} }));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getByLabelText('USD → KZT')).toBeDisabled();
    expect(screen.getByText('Автоматический режим')).toBeInTheDocument();
  });

  it('shows the destructive manual state and enables rate inputs', async () => {
    const user = userEvent.setup();
    window.vetka.settings.getAll = vi.fn(async () => ({ ok: true as const, data: {} }));
    renderPage();
    await screen.findByRole('heading', { name: 'Настройки' });
    await user.click(screen.getByRole('switch', { name: 'Ручной режим курсов' }));
    expect(screen.getByText('Ручные курсы')).toBeInTheDocument();
    expect(screen.getByLabelText('USD → KZT')).toBeEnabled();
  });
});
