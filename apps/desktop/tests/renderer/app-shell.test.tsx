import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/renderer/app';

describe('App shell', () => {
  it('renders compact navigation, version, and a quick add action', async () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Избранное' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Куклы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Коллекционки' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Заказы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить куклу' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('Vetka Desktop vtest')).toBeInTheDocument();
  });

  it('shows a compact update action beside the version only after an update downloads', async () => {
    const user = userEvent.setup();
    const restartAndInstall = vi.fn(async () => ({ ok: true as const, data: null }));
    window.vetka = {
      ...window.vetka,
      updates: {
        ...window.vetka.updates,
        getState: vi.fn(async () => ({ ok: true as const, data: { status: 'downloaded' as const, version: '1.0.8' } })),
        restartAndInstall,
        onStateChanged: vi.fn(() => (): void => undefined),
      },
    };
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Обновить' }));
    expect(restartAndInstall).toHaveBeenCalledOnce();
  });

  it('shows the same action disabled while an available update is downloading', async () => {
    window.vetka = {
      ...window.vetka,
      updates: {
        ...window.vetka.updates,
        getState: vi.fn(async () => ({ ok: true as const, data: { status: 'available' as const, version: '1.0.9' } })),
        onStateChanged: vi.fn(() => (): void => undefined),
      },
    };
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Обновить' }).some((button) => button.hasAttribute('disabled'))).toBe(true));
  });
});
