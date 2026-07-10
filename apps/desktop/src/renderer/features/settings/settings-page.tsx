import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SaveIcon } from 'lucide-react';
import { toast } from 'sonner';

import { FormSection } from '@/components/patterns/form-section';
import { PageHeader } from '@/components/patterns/page-header';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { unwrap } from '@/renderer/lib/ipc-query';

type StoredSettings = { exchangeRates?: Record<string, { rateMicros: number }>; deliveryDefaults?: { weightGrams: number; tariffPerKg: number } };

export function SettingsPage() {
  const queryClient = useQueryClient(); const settings = useQuery({ queryKey: ['settings'], queryFn: async () => unwrap(await window.vetka.settings.getAll()) as StoredSettings });
  if (settings.isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 max-w-4xl" /></div>;
  const rates = settings.data?.exchangeRates ?? {}; const delivery = settings.data?.deliveryDefaults ?? { weightGrams: 700, tariffPerKg: 12 };
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const now = new Date().toISOString(); try { unwrap(await window.vetka.settings.set('exchangeRates', Object.fromEntries(['USD', 'EUR', 'GBP'].map((currency) => [currency, { rateMicros: Math.round(Number(data.get(currency)) * 1_000_000), updatedAt: now, source: 'manual' }])))); unwrap(await window.vetka.settings.set('deliveryDefaults', { weightGrams: Math.round(Number(data.get('weight'))), tariffPerKg: Number(data.get('tariff')) })); await queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Настройки сохранены'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки'); } }
  return <section className="flex flex-1 flex-col gap-6 p-6"><PageHeader title="Настройки" description="Курсы, доставка и локальные данные" /><form className="max-w-4xl space-y-8" onSubmit={save}><FormSection title="Курсы валют" description="Тенге за единицу валюты; курс сохраняется вместе с ценой."><FieldGroup>{['USD', 'EUR', 'GBP'].map((currency) => <Field key={currency} className="max-w-56"><FieldLabel htmlFor={`rate-${currency}`}>{currency} → KZT</FieldLabel><Input id={`rate-${currency}`} name={currency} type="number" min="0.000001" step="0.000001" required defaultValue={rates[currency]?.rateMicros ? rates[currency].rateMicros / 1_000_000 : ''} /></Field>)}</FieldGroup></FormSection><FormSection title="Доставка" description="Начальные значения для нового заказа."><FieldGroup className="grid max-w-md grid-cols-2 gap-4"><Field><FieldLabel htmlFor="default-weight">Вес по умолчанию, г</FieldLabel><Input id="default-weight" name="weight" type="number" min="1" required defaultValue={delivery.weightGrams} /></Field><Field><FieldLabel htmlFor="default-tariff">Тариф за кг</FieldLabel><Input id="default-tariff" name="tariff" type="number" min="0" step="0.01" required defaultValue={delivery.tariffPerKg} /><FieldDescription>В валюте предложения Amazon.</FieldDescription></Field></FieldGroup></FormSection><FormSection title="Локальные данные" description="База, история цен и заказы хранятся только на этом компьютере. При запуске создаётся резервная копия." /><div><Button type="submit"><SaveIcon />Сохранить настройки</Button></div></form></section>;
}
