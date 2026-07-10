import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBagIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { calculateOrder } from '@/domain/calculations';
import { formatKzt, formatMoney, unwrap } from '@/renderer/lib/ipc-query';
import type { CurrentPrice } from '@/shared/contracts';

const number = (value: FormDataEntryValue | null, fallback = 0) => Number(value ?? fallback) || fallback;

export function CreateOrderSheet({ prices }: { prices: CurrentPrice[] }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(prices[0]?.snapshotId ?? '');
  const [preview, setPreview] = useState({ weight: 700, tariff: 12, extra: 0, customer: 0, local: 0 });
  const queryClient = useQueryClient();
  const selected = prices.find((price) => price.snapshotId === selectedId) ?? prices[0];
  const calculation = useMemo(() => selected ? calculateOrder({ sourcePriceMinor: selected.priceMinor, sourceRateToKztMicros: selected.rateToKztMicros, localShippingMinor: Math.round(preview.local * 100), localShippingRateToKztMicros: selected.rateToKztMicros, weightGrams: preview.weight, internationalRateMinorPerKg: Math.round(preview.tariff * 100), internationalRateToKztMicros: selected.rateToKztMicros, extraCostsKztMinor: Math.round(preview.extra * 100), customerPriceKztMinor: Math.round(preview.customer * 100) }) : null, [selected, preview]);
  const create = useMutation({ mutationFn: async (form: HTMLFormElement) => {
    if (!selected) throw new Error('Сначала нужна подтверждённая цена');
    const data = new FormData(form);
    return unwrap(await window.vetka.orders.create({ snapshotId: selected.snapshotId, customerContact: String(data.get('contact') ?? '').trim(), localShippingMinor: Math.round(number(data.get('local')) * 100), localShippingRateToKztMicros: selected.rateToKztMicros, weightGrams: Math.round(number(data.get('weight'), 700)), internationalRateMinorPerKg: Math.round(number(data.get('tariff'), 12) * 100), internationalRateCurrency: selected.currency, internationalRateToKztMicros: selected.rateToKztMicros, extraCostsKztMinor: Math.round(number(data.get('extra')) * 100), customerPriceKztMinor: Math.round(number(data.get('customer')) * 100), notes: String(data.get('notes') ?? '').trim() || null }));
  }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Заказ создан'); setOpen(false); }, onError: (error) => toast.error(error.message) });

  return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button disabled={!prices.length}><ShoppingBagIcon />Создать заказ</Button></SheetTrigger><SheetContent className="w-full overflow-y-auto sm:max-w-3xl"><SheetHeader><SheetTitle>Новый заказ</SheetTitle><SheetDescription>Контакт из Telegram, доставка и итоговая цена в одном расчёте.</SheetDescription></SheetHeader>
    <form className="grid gap-6 px-4 pb-6 md:grid-cols-[minmax(0,1fr)_280px]" onSubmit={(event) => { event.preventDefault(); create.mutate(event.currentTarget); }}>
      <FieldGroup>
        <Field><FieldLabel>Предложение Amazon</FieldLabel><Select value={selected?.snapshotId} onValueChange={setSelectedId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{prices.map((price) => <SelectItem key={price.snapshotId} value={price.snapshotId}>{price.region.toUpperCase()} · {formatMoney(price.priceMinor, price.currency)}</SelectItem>)}</SelectContent></Select>{selected && <p className="text-xs text-muted-foreground">{selected.asin} · {selected.sellerName ?? 'продавец не указан'}</p>}</Field>
        <Field><FieldLabel htmlFor="order-contact">Контакт клиента</FieldLabel><Input id="order-contact" name="contact" required placeholder="@username или имя" /></Field>
        <div className="grid grid-cols-2 gap-4"><Field><FieldLabel htmlFor="order-weight">Вес, г</FieldLabel><Input id="order-weight" name="weight" type="number" min="1" defaultValue="700" onChange={(e) => setPreview((value) => ({ ...value, weight: Number(e.target.value) }))} /></Field><Field><FieldLabel htmlFor="order-tariff">Тариф / кг</FieldLabel><Input id="order-tariff" name="tariff" type="number" min="0" step="0.01" defaultValue="12" onChange={(e) => setPreview((value) => ({ ...value, tariff: Number(e.target.value) }))} /></Field></div>
        <div className="grid grid-cols-2 gap-4"><Field><FieldLabel htmlFor="order-local">Доставка по стране</FieldLabel><Input id="order-local" name="local" type="number" min="0" step="0.01" defaultValue="0" onChange={(e) => setPreview((value) => ({ ...value, local: Number(e.target.value) }))} /></Field><Field><FieldLabel htmlFor="order-extra">Доп. расходы, ₸</FieldLabel><Input id="order-extra" name="extra" type="number" min="0" defaultValue="0" onChange={(e) => setPreview((value) => ({ ...value, extra: Number(e.target.value) }))} /></Field></div>
        <Field><FieldLabel htmlFor="order-customer">Цена клиенту, ₸</FieldLabel><Input id="order-customer" name="customer" type="number" min="0" required onChange={(e) => setPreview((value) => ({ ...value, customer: Number(e.target.value) }))} /></Field>
        <Field><FieldLabel htmlFor="order-notes">Заметки</FieldLabel><Textarea id="order-notes" name="notes" /></Field>
      </FieldGroup>
      <Card className="h-fit md:sticky md:top-4"><CardHeader><CardTitle>Расчёт</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{selected && calculation ? <><div className="flex justify-between"><span className="text-muted-foreground">Кукла</span><span>{formatKzt(calculation.sourcePriceKztMinor)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Доставка</span><span>{formatKzt(calculation.internationalShippingKztMinor)}</span></div><Separator /><div className="flex justify-between font-medium"><span>Себестоимость</span><span>{formatKzt(calculation.totalCostKztMinor)}</span></div><div className="flex justify-between"><span>Прибыль</span><Badge variant={calculation.profitKztMinor >= 0 ? 'secondary' : 'destructive'}>{formatKzt(calculation.profitKztMinor)}</Badge></div></> : <p className="text-muted-foreground">Выберите цену</p>}</CardContent></Card>
      <SheetFooter className="md:col-span-2"><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Создаю…' : 'Создать заказ'}</Button></SheetFooter>
    </form>
  </SheetContent></Sheet>;
}
