import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CollectiblesScanState } from '@/shared/contracts';

export function CollectiblesScanStatus({ state, pending, onRefresh }: { state?: CollectiblesScanState; pending: boolean; onRefresh(): void }) {
  const running = pending || state?.status === 'running';
  return <div className="space-y-3">
    {state?.lastError && <Alert><AlertTriangleIcon /><AlertTitle>Часть коллекционок не удалось проверить</AlertTitle><AlertDescription>Последние подтверждённые данные сохранены. Повторите обновление позже.</AlertDescription></Alert>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{running ? `Проверяю Mattel Creations${state?.total ? ` · ${state.processed} из ${state.total}` : '…'}` : state?.nextRunAt ? `Следующая проверка ${new Date(state.nextRunAt).toLocaleString('ru-RU')}` : 'Прямое обновление раз в сутки без прокси'}</span>
      <Button size="sm" variant="outline" disabled={running} onClick={onRefresh}><RefreshCwIcon className={running ? 'animate-spin' : ''} />Обновить сейчас</Button>
    </div>
  </div>;
}
