import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { PriceHistoryRecord } from '@/shared/contracts';

type Range = '7d' | '30d' | '90d' | 'all';
const ranges: Array<{ value: Range; label: string }> = [{ value: '7d', label: '7д' }, { value: '30d', label: '30д' }, { value: '90d', label: '90д' }, { value: 'all', label: 'Всё' }];
const chartConfig = { price: { label: 'Цена в ₸', color: 'var(--chart-1)' } } satisfies ChartConfig;

export function PriceHistoryChart({ points, range, onRangeChange }: { points: PriceHistoryRecord[]; range: Range; onRangeChange(range: Range): void }) {
  const data = points.map((point) => ({ ...point, time: new Date(point.checkedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }), price: Math.round(point.priceKztMinor / 100) }));
  return <div className="space-y-4"><div className="flex justify-end gap-1">{ranges.map((item) => <Button key={item.value} size="sm" variant={range === item.value ? 'secondary' : 'ghost'} onClick={() => onRangeChange(item.value)}>{item.label}</Button>)}</div>
    {data.length === 0 ? <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">История появится после первой успешной проверки</div> : <ChartContainer config={chartConfig} className="h-72 w-full aspect-auto"><LineChart data={data} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="time" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={72} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="price" type="monotone" stroke="var(--color-price)" strokeWidth={2} dot={false} connectNulls={false} /></LineChart></ChartContainer>}
  </div>;
}
