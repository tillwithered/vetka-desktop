import { useEffect, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { UpdateState } from '@/shared/contracts';

type DownloadedState = Extract<UpdateState, { status: 'downloaded' }>;

const SAFE_UPDATE_ERROR = 'Не удалось проверить обновления';

export function UpdateNotification() {
  const [downloaded, setDownloaded] = useState<DownloadedState | null>(null);

  useEffect(() => {
    let active = true;
    let observedEvent = false;

    const applyState = (state: UpdateState) => {
      if (!active) return;
      if (state.status === 'downloaded') {
        setDownloaded(state);
        return;
      }
      setDownloaded(null);
      if (state.status === 'error') toast.error(SAFE_UPDATE_ERROR);
    };

    const unsubscribe = window.vetka.updates.onStateChanged((state) => {
      observedEvent = true;
      applyState(state);
    });
    void window.vetka.updates.getState().then((result) => {
      if (!observedEvent && result.ok) applyState(result.data);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!downloaded) return null;

  const restart = async () => {
    const result = await window.vetka.updates.restartAndInstall();
    if (!result.ok) toast.error('Не удалось перезапустить приложение');
  };

  return (
    <Alert className="fixed right-4 bottom-4 z-50 w-[min(28rem,calc(100vw-2rem))] shadow-lg">
      <RefreshCwIcon />
      <AlertTitle>Обновление готово</AlertTitle>
      <AlertDescription>
        {downloaded.version
          ? `Версия ${downloaded.version} уже загружена`
          : 'Новая версия уже загружена'}
      </AlertDescription>
      <AlertAction className="static col-span-full mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setDownloaded(null)}>Позже</Button>
        <Button onClick={() => void restart()}>Перезапустить сейчас</Button>
      </AlertAction>
    </Alert>
  );
}
