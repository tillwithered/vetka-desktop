import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/renderer/features/settings/settings-page';

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
}

afterEach(cleanup);

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

  it('checks updates from Settings without restarting the application', async () => {
    const user = userEvent.setup();
    window.vetka.settings.getAll = vi.fn(async () => ({ ok: true as const, data: {} }));
    window.vetka.health = vi.fn(async () => ({ ok: true as const, data: { version: '1.0.16' } }));
    window.vetka.updates.getState = vi.fn(async () => ({ ok: true as const, data: { status: 'idle' as const } }));
    window.vetka.updates.check = vi.fn(async () => ({ ok: true as const, data: { status: 'checking' as const } }));
    window.vetka.updates.restartAndInstall = vi.fn(async () => ({ ok: true as const, data: null }));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Проверить обновления' }));

    expect(window.vetka.health).toHaveBeenCalledTimes(1);
    expect(window.vetka.updates.check).toHaveBeenCalledTimes(1);
    expect(window.vetka.updates.restartAndInstall).not.toHaveBeenCalled();
    expect(screen.getByText('Vetka Desktop v1.0.16')).toBeInTheDocument();
  });
});
