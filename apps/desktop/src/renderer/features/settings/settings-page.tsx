import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseIcon, Globe2Icon, SaveIcon, TruckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { unwrap } from '@/renderer/lib/ipc-query';

type StoredSettings = {
  exchangeRates?: Record<string, { rateMicros: number; updatedAt: string; source: string }>;
  deliveryDefaults?: { weightGrams: number; tariffPerKg: number };
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: async () => unwrap(await window.vetka.settings.getAll()) as StoredSettings });
  if (settings.isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  const rates = settings.data?.exchangeRates ?? {};
  const delivery = settings.data?.deliveryDefaults ?? { weightGrams: 700, tariffPerKg: 12 };

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const now = new Date().toISOString();
    try {
      unwrap(await window.vetka.settings.set('exchangeRates', Object.fromEntries(['USD', 'EUR', 'GBP'].map((currency) => [currency, { rateMicros: Math.round(Number(data.get(currency)) * 1_000_000), updatedAt: now, source: 'manual' }]))));
      unwrap(await window.vetka.settings.set('deliveryDefaults', { weightGrams: Math.round(Number(data.get('weight'))), tariffPerKg: Number(data.get('tariff')) }));
      await queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Настройки сохранены');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки'); }
  }

  return <section className="flex flex-1 flex-col gap-6 p-6"><header><h1 className="text-2xl font-semibold">Настройки</h1><p className="text-sm text-muted-foreground">Курсы, доставка и локальные данные</p></header><form onSubmit={save} className="grid gap-6 xl:grid-cols-2">
    <Card><CardHeader><div className="flex items-center gap-2"><Globe2Icon className="size-5" /><CardTitle>Курсы валют</CardTitle></div><CardDescription>Введите тенге за одну единицу валюты. Курс сохраняется вместе с каждой ценой.</CardDescription></CardHeader><CardContent><FieldGroup>{['USD', 'EUR', 'GBP'].map((currency) => <Field key={currency}><FieldLabel htmlFor={`rate-${currency}`}>{currency} → KZT</FieldLabel><Input id={`rate-${currency}`} name={currency} type="number" min="0.000001" step="0.000001" required defaultValue={rates[currency]?.rateMicros ? rates[currency].rateMicros / 1_000_000 : ''} placeholder="Укажите актуальный курс" /></Field>)}</FieldGroup></CardContent></Card>
    <Card><CardHeader><div className="flex items-center gap-2"><TruckIcon className="size-5" /><CardTitle>Доставка</CardTitle></div><CardDescription>Начальные значения для нового заказа.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="default-weight">Вес по умолчанию, г</FieldLabel><Input id="default-weight" name="weight" type="number" min="1" required defaultValue={delivery.weightGrams} /></Field><Field><FieldLabel htmlFor="default-tariff">Тариф за кг</FieldLabel><Input id="default-tariff" name="tariff" type="number" min="0" step="0.01" required defaultValue={delivery.tariffPerKg} /><FieldDescription>В валюте выбранного предложения Amazon.</FieldDescription></Field></FieldGroup></CardContent></Card>
    <Card className="xl:col-span-2"><CardHeader><div className="flex items-center gap-2"><DatabaseIcon className="size-5" /><CardTitle>Локальные данные</CardTitle></div><CardDescription>База, история цен и заказы находятся только на этом компьютере. При каждом запуске создаётся резервная копия, хранятся последние семь.</CardDescription></CardHeader></Card>
    <div className="xl:col-span-2"><Button type="submit"><SaveIcon />Сохранить настройки</Button></div>
  </form></section>;
}
