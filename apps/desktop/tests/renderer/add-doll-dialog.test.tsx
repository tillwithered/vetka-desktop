import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AddDollDialog } from '@/renderer/features/dolls/add-doll-dialog';

describe('AddDollDialog', () => {
  it('keeps an invalid Amazon URL and creates a doll with a valid one', async () => {
    const user = userEvent.setup();
    const create = vi.fn(async () => ({ ok: true as const, data: { id: 'd1', name: 'Draculaura', characterName: null, lineName: null, generation: null, mattelSku: null, upcEan: null, imagePath: null, notes: null, isFavorite: false, createdAt: '', updatedAt: '' } }));
    const addListing = vi.fn(async () => ({ ok: true as const, data: {} }));
    window.vetka.dolls.create = create;
    window.vetka.amazon.addListing = addListing;
    render(<QueryClientProvider client={new QueryClient()}><AddDollDialog /></QueryClientProvider>);

    await user.click(screen.getByRole('button', { name: 'Добавить куклу' }));
    await user.type(screen.getByLabelText('Название'), 'Draculaura');
    await user.type(screen.getByLabelText('Ссылка Amazon'), 'https://example.com/nope');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Нужна ссылка на карточку Amazon')).toBeInTheDocument();
    expect(screen.getByLabelText('Ссылка Amazon')).toHaveValue('https://example.com/nope');

    await user.clear(screen.getByLabelText('Ссылка Amazon'));
    await user.type(screen.getByLabelText('Ссылка Amazon'), 'https://www.amazon.com/dp/B0CXYZ1234');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(create).toHaveBeenCalled();
    expect(addListing).toHaveBeenCalledWith('d1', 'https://www.amazon.com/dp/B0CXYZ1234');
  });
});
