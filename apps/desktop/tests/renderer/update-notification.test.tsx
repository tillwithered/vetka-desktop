import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { UpdateNotification } from '@/renderer/features/updates/update-notification';
import type { UpdateState, VetkaDesktopApi } from '@/shared/contracts';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

function installUpdateApi(initialState: UpdateState = { status: 'idle' }) {
  let listener: ((state: UpdateState) => void) | undefined;
  const unsubscribe = vi.fn();
  const updates: VetkaDesktopApi['updates'] = {
    getState: vi.fn(async () => ({ ok: true as const, data: initialState })),
    check: vi.fn(async () => ({ ok: true as const, data: initialState })),
    restartAndInstall: vi.fn(async () => ({ ok: true as const, data: null })),
    onStateChanged: vi.fn((nextListener) => {
      listener = nextListener;
      return unsubscribe;
    }),
  };
  window.vetka = { ...window.vetka, updates };
  return { emit: (state: UpdateState) => listener?.(state), unsubscribe, updates };
}

beforeEach(() => vi.clearAllMocks());

describe('UpdateNotification', () => {
  it('stays unobtrusive for idle, checking, and available states', async () => {
    const harness = installUpdateApi();
    render(<UpdateNotification />);
    await waitFor(() => expect(harness.updates.getState).toHaveBeenCalledTimes(1));
    harness.emit({ status: 'checking' });
    harness.emit({ status: 'available', version: '1.0.1' });
    expect(screen.queryByText('Обновление готово')).not.toBeInTheDocument();
  });

  it('renders an update already held by main state and supports restart', async () => {
    const user = userEvent.setup();
    const harness = installUpdateApi({ status: 'downloaded', version: '1.0.1' });
    render(<UpdateNotification />);
    expect(await screen.findByText('Обновление готово')).toBeInTheDocument();
    expect(screen.getByText('Версия 1.0.1 уже загружена')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Позже' }));
    expect(screen.queryByText('Обновление готово')).not.toBeInTheDocument();
    harness.emit({ status: 'downloaded', version: '1.0.1' });
    expect(await screen.findByText('Обновление готово')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Перезапустить сейчас' }));
    expect(harness.updates.restartAndInstall).toHaveBeenCalledTimes(1);
  });

  it('shows only a safe non-blocking error toast', async () => {
    const harness = installUpdateApi();
    render(<UpdateNotification />);
    await waitFor(() => expect(harness.updates.getState).toHaveBeenCalledTimes(1));
    harness.emit({ status: 'error', message: 'secret token and stack' });
    expect(toast.error).toHaveBeenCalledWith('Не удалось проверить обновления');
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('token'));
  });

  it('unsubscribes exactly once on unmount', () => {
    const harness = installUpdateApi();
    const view = render(<UpdateNotification />);
    view.unmount();
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
