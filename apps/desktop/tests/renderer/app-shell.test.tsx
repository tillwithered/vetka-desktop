import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/renderer/app';

describe('App shell', () => {
  it('renders compact navigation, version, and a quick add action', async () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Избранное' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Куклы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Заказы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить куклу' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('Vetka Desktop vtest')).toBeInTheDocument();
  });
});
