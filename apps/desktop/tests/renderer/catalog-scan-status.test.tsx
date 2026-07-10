import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CatalogScanStatus } from '@/renderer/features/dolls/catalog-scan-status';

describe('CatalogScanStatus', () => {
  it('shows the next scan and starts a manual refresh', async () => {
    const refreshNow = vi.fn(async () => ({ ok: true as const, data: { status: 'running' as const, startedAt: '2026-07-10T10:00:00.000Z', completedAt: null, nextRunAt: null, processed: 1, total: 16 } }));
    window.vetka.catalog.getScanState = async () => ({ ok: true, data: { status: 'idle', startedAt: null, completedAt: null, nextRunAt: '2026-07-10T12:00:00.000Z', processed: 16, total: 16 } });
    window.vetka.catalog.refreshNow = refreshNow;
    render(<CatalogScanStatus />);

    expect(await screen.findByText(/Следующая проверка/i)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Обновить сейчас/i }));
    expect(refreshNow).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/1 из 16/i)).toBeVisible();
  });
});
