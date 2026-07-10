import type { ApiResult } from '@/shared/contracts';

export function unwrap<T>(result: ApiResult<T>): T {
  if ('error' in result) throw new Error(result.error.message);
  return result.data;
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(minor / 100);
}

export function formatKzt(minor: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(minor / 100);
}
