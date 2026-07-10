import { useEffect, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CatalogScanState } from '@/shared/contracts';
import { unwrap } from '@/renderer/lib/ipc-query';

function displayTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function CatalogScanStatus() {
  const [state, setState] = useState<CatalogScanState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void window.vetka.catalog.getScanState().then((result) => {
      if (!active) return;
      try { setState(unwrap(result)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось получить статус сканирования'); }
    });
    const unsubscribe = window.vetka.catalog.onScanStateChanged((next) => active && setState(next));
    return () => { active = false; unsubscribe(); };
  }, []);

  const refresh = async () => {
    try { setState(unwrap(await window.vetka.catalog.refreshNow())); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось запустить проверку'); }
  };

  const running = state?.status === 'running';
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
    <div className="min-w-0 space-y-1">
      {state?.phase === 'official_store' && <p className="text-xs text-muted-foreground">Monster High Store {state.region?.replace('amazon_', '').toUpperCase() ?? 'все регионы'}</p>}
      <div className="flex items-center gap-2"><span className="text-sm font-medium">Автопроверка Amazon</span><Badge variant={running ? 'default' : 'secondary'}>{running ? `Проверяется: ${state?.processed ?? 0} из ${state?.total ?? 0}` : 'По расписанию'}</Badge></div>
      <p className="text-xs text-muted-foreground">{running ? 'Сканирование идёт по SKU в US, UK, DE и ES.' : `Следующая проверка: ${displayTime(state?.nextRunAt ?? null)}`}</p>
      {state?.lastError && <p role="alert" className="text-xs text-destructive">{state.lastError}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
    <Button size="sm" onClick={() => void refresh()} disabled={running}><RefreshCwIcon className={running ? 'animate-spin' : ''} />{running ? 'Обновляется' : 'Обновить сейчас'}</Button>
  </div>;
}
