import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CatalogScanStatus } from '@/renderer/features/dolls/catalog-scan-status';

describe('CatalogScanStatus', () => {
  it('shows the next daily price check and starts a manual refresh', async () => {
    const refreshNow = vi.fn(async () => ({ ok: true as const, data: { status: 'running' as const, phase: 'catalog_scan' as const, region: null, startedAt: '2026-07-10T10:00:00.000Z', completedAt: null, nextRunAt: null, processed: 1, total: 16 } }));
    window.vetka.catalog.getScanState = async () => ({ ok: true, data: { status: 'idle', phase: null, region: null, startedAt: null, completedAt: null, nextRunAt: '2026-07-11T10:00:00.000Z', processed: 16, total: 16 } });
    window.vetka.catalog.refreshNow = refreshNow;
    render(<CatalogScanStatus />);

    expect(await screen.findByText('Проверка цен')).toBeVisible();
    expect(await screen.findByText(/Следующая проверка:/i)).toBeVisible();
    expect(screen.queryByText(/Monster High Store/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Обновить сейчас/i }));
    expect(refreshNow).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Проверяются цены: 1 из 16')).toBeVisible();
  });

  it('shows daily price progress instead of an Amazon Store import', async () => {
    window.vetka.catalog.getScanState = async () => ({ ok: true, data: { status: 'running', phase: 'catalog_scan', region: null, startedAt: '2026-07-10T10:00:00.000Z', completedAt: null, nextRunAt: null, processed: 2, total: 29 } });
    render(<CatalogScanStatus />);
    expect(await screen.findByText('Проверяются цены: 2 из 29')).toBeVisible();
    expect(screen.getAllByText('Ищу новые карточки Amazon и обновляю найденные цены.').at(-1)).toBeVisible();
  });

  it('explains that idle pricing is scheduled once per day', async () => {
    window.vetka.catalog.getScanState = async () => ({ ok: true, data: { status: 'idle', phase: null, region: null, startedAt: null, completedAt: '2026-07-10T10:00:00.000Z', nextRunAt: '2026-07-11T10:00:00.000Z', processed: 29, total: 29 } });
    render(<CatalogScanStatus />);
    expect(await screen.findByText('По расписанию: раз в день')).toBeVisible();
  });
});
