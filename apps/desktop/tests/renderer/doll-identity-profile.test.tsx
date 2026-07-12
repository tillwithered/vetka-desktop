import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DollIdentityProfile } from '@/renderer/features/dolls/doll-identity-profile';
import type { Doll } from '@/shared/contracts';

const doll: Doll = {
  id: 'd1', name: 'Draculaura Core Refresh', characterName: 'Draculaura', lineName: 'Core Refresh', generation: 'G3',
  mattelSku: 'HRP64', officialName: null, mattelUrl: null, upcEan: '194735183302', imagePath: 'https://images.example/draculaura.jpg', imageSource: 'mattel', notes: null,
  isFavorite: false, createdAt: '', updatedAt: '',
};

describe('DollIdentityProfile', () => {
  it('shows a thumbnail and operational identifiers without hiding Amazon regions elsewhere', () => {
    render(<DollIdentityProfile doll={doll} />);
    expect(screen.getByText('О кукле')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Draculaura Core Refresh' })).toHaveAttribute('src', doll.imagePath);
    expect(screen.getByText('Mattel SKU')).toBeInTheDocument();
    expect(screen.getByText('HRP64')).toBeInTheDocument();
    expect(screen.getByText('UPC / EAN')).toBeInTheDocument();
    expect(screen.getByText('194735183302')).toBeInTheDocument();
  });

  it('uses a neutral placeholder and em dash for absent identifiers', () => {
    render(<DollIdentityProfile doll={{ ...doll, imagePath: null, mattelSku: null, upcEan: null }} />);
    expect(screen.getByLabelText('Нет фото куклы')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the official English Mattel title and compact source link', () => {
    render(<DollIdentityProfile doll={{
      ...doll,
      name: 'Кэтти Нуар — Core',
      officialName: 'Monster High Catty Noir Fashion Doll With Pet Cat Amulette And Accessories',
      mattelUrl: 'https://shop.mattel.com/products/monster-high-catty-noir-doll-hxh76',
    }} />);

    expect(screen.getAllByText('Официальное название').at(-1)).toBeVisible();
    expect(screen.getByText(/Monster High Catty Noir Fashion Doll With Pet Cat/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Открыть на Mattel' })).toHaveAttribute('href', expect.stringContaining('shop.mattel.com'));
  });
});
