import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/renderer/app';

describe('App', () => {
  it('renders the four V0 destinations', () => {
    render(<App />);

    expect(screen.getAllByText('Избранное').length).toBeGreaterThan(0);
    expect(screen.getByText('Куклы')).toBeInTheDocument();
    expect(screen.getByText('Заказы')).toBeInTheDocument();
    expect(screen.getByText('Настройки')).toBeInTheDocument();
  });
});
