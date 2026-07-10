import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, SaveIcon } from 'lucide-react';
import { toast } from 'sonner';
import { FormSection } from '@/components/patterns/form-section';
import { PageHeader } from '@/components/patterns/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { unwrap } from '@/renderer/lib/ipc-query';

type Rates = Record<string, { rateMicros: number; updatedAt?: string; source?: 'nbk' | 'manual' }>;
type StoredSettings = { exchangeRates?: Rates; exchangeRatesMode?: 'auto' | 'manual'; deliveryDefaults?: { weightGrams: number; tariffPerKg: number } };

export function SettingsPage() {
  const queryClient = useQueryClient(); const settings = useQuery({ queryKey: ['settings'], queryFn: async () => unwrap(await window.vetka.settings.getAll()) as StoredSettings });
  const [manual, setManual] = useState(false);
  if (settings.isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 max-w-4xl" /></div>;
  const rates = settings.data?.exchangeRates ?? {}; const mode = manual || settings.data?.exchangeRatesMode === 'manual'; const delivery = settings.data?.deliveryDefaults ?? { weightGrams: 700, tariffPerKg: 12 };
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const now = new Date().toISOString(); try { if (mode) unwrap(await window.vetka.settings.set('exchangeRates', Object.fromEntries(['USD', 'EUR', 'GBP'].map((currency) => [currency, { rateMicros: Math.round(Number(data.get(currency)) * 1_000_000), updatedAt: now, source: 'manual' }])))); unwrap(await window.vetka.settings.set('exchangeRatesMode', mode ? 'manual' : 'auto')); unwrap(await window.vetka.settings.set('deliveryDefaults', { weightGrams: Math.round(Number(data.get('weight'))), tariffPerKg: Number(data.get('tariff')) })); await queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Настройки сохранены'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки'); } }
  return <section className="flex flex-1 flex-col gap-6 p-6"><PageHeader title="Настройки" description="Курсы, доставка и локальные данные" /><form className="max-w-4xl space-y-8" onSubmit={save}><FormSection title="Курсы валют" description="Тенге за единицу валюты; курс сохраняется вместе с ценой."><div className="mb-4 flex items-center gap-3"><Switch checked={mode} onCheckedChange={setManual} aria-label="Ручной режим курсов" /><span className="text-sm font-medium">{mode ? 'Ручной режим' : 'Автоматический режим НБК'}</span>{mode ? <Badge variant="destructive"><AlertTriangleIcon />Ручные курсы</Badge> : <Badge variant="secondary">НБК Казахстана</Badge>}</div><FieldGroup>{['USD', 'EUR', 'GBP'].map((currency) => <Field key={currency} className="max-w-56"><FieldLabel htmlFor={`rate-${currency}`}>{currency} → KZT</FieldLabel><Input id={`rate-${currency}`} name={currency} type="number" min="0.000001" step="0.000001" disabled={!mode} required={mode} defaultValue={rates[currency]?.rateMicros ? rates[currency].rateMicros / 1_000_000 : ''} /><FieldDescription>{rates[currency]?.updatedAt ? `Обновлено: ${new Date(rates[currency].updatedAt).toLocaleDateString('ru-RU')}` : 'Курс будет загружен при запуске.'}</FieldDescription></Field>)}</FieldGroup></FormSection><FormSection title="Доставка" description="Начальные значения для нового заказа."><FieldGroup className="grid max-w-md grid-cols-2 gap-4"><Field><FieldLabel htmlFor="default-weight">Вес по умолчанию, г</FieldLabel><Input id="default-weight" name="weight" type="number" min="1" required defaultValue={delivery.weightGrams} /></Field><Field><FieldLabel htmlFor="default-tariff">Тариф за кг</FieldLabel><Input id="default-tariff" name="tariff" type="number" min="0" step="0.01" required defaultValue={delivery.tariffPerKg} /></Field></FieldGroup></FormSection><div><Button type="submit"><SaveIcon />Сохранить настройки</Button></div></form></section>;
}
