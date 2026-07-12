import { ExternalLinkIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKzt, formatMoney } from '@/renderer/lib/ipc-query';
import type { AmazonRegion, RegionalPriceState, RegionalPriceStatus } from '@/shared/contracts';

const labels: Record<AmazonRegion, string> = {
  amazon_us: 'Amazon US', amazon_uk: 'Amazon UK', amazon_de: 'Amazon DE', amazon_es: 'Amazon ES', amazon_it: 'Amazon IT',
};

const statusLabels: Record<RegionalPriceStatus, string> = {
  unchecked: 'Ещё не проверено', verified: 'Цена подтверждена', no_price: 'Сейчас без цены',
  out_of_stock: 'Нет в наличии', not_found: 'Карточка не найдена', needs_review: 'Не удалось проверить',
  captcha_required: 'Не удалось проверить', blocked: 'Не удалось проверить', parser_changed: 'Не удалось проверить',
  identity_mismatch: 'Не удалось проверить', network_error: 'Не удалось проверить', conflict: 'Не удалось проверить',
};

const statusDescriptions: Record<RegionalPriceStatus, string> = {
  unchecked: 'Регион ещё не проверен.', verified: 'Новая цена подтверждена на Amazon.',
  no_price: 'Amazon не показал цену при последней проверке.', out_of_stock: 'Карточка есть, но товар недоступен.',
  not_found: 'Точная карточка по Mattel SKU не найдена.', needs_review: 'Результат требует повторной проверки.',
  captcha_required: 'Amazon запросил проверку CAPTCHA.', blocked: 'Amazon временно ограничил проверку.',
  parser_changed: 'Страница Amazon изменилась.', identity_mismatch: 'Карточка не совпала с куклой.',
  network_error: 'Amazon не ответил на запрос.', conflict: 'Найден конфликт идентификаторов.',
};

function checkedLabel(checkedAt: string | null): string {
  if (!checkedAt) return 'Проверки ещё не было';
  return `Проверено ${new Date(checkedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`;
}

function isErrorStatus(status: RegionalPriceStatus): boolean {
  return ['needs_review', 'captcha_required', 'blocked', 'parser_changed', 'identity_mismatch', 'network_error', 'conflict'].includes(status);
}

export function RegionalOfferList({ states, loading = false, error = false }: { states: RegionalPriceState[]; loading?: boolean; error?: boolean }) {
  if (loading) return <div className="space-y-4" aria-label="Загрузка регионов Amazon">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Не удалось загрузить результаты Amazon</AlertTitle><AlertDescription>Повторите проверку цен.</AlertDescription></Alert>;
  return <div>{states.map((state, index) => {
    const price = state.currentPrice;
    const label = labels[state.region];
    return <div key={state.region}>{index > 0 && <Separator />}<div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{label}</span>
          <Badge variant={state.status === 'verified' ? 'default' : isErrorStatus(state.status) ? 'destructive' : 'secondary'}>{statusLabels[state.status]}</Badge>
          {state.overdue ? <Badge variant="outline">Проверка просрочена</Badge> : null}
        </div>
        {price ? <>
          <div className="text-lg font-semibold">{formatMoney(price.priceMinor, price.currency)} <span className="text-sm font-normal text-muted-foreground">· {formatKzt(price.priceKztMinor)}</span></div>
          <p className="truncate text-xs text-muted-foreground">{price.sellerName ?? 'Продавец не указан'} · {price.fulfilledByAmazon ? 'доставка Amazon' : 'сторонняя доставка'}</p>
        </> : <p className="text-sm text-muted-foreground">{statusDescriptions[state.status]}</p>}
        <p className="text-xs text-muted-foreground">{checkedLabel(state.checkedAt)}{state.asin ? ` · ${state.asin}` : ''}</p>
      </div>
      <Button asChild size="icon-sm" variant="ghost"><a href={state.evidenceUrl} target="_blank" rel="noreferrer" aria-label={`Открыть ${label}`}><ExternalLinkIcon /></a></Button>
    </div></div>;
  })}</div>;
}
