import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PriceHistoryChart } from '@/renderer/features/prices/price-history-chart';

describe('PriceHistoryChart', () => {
  it('renders range controls and an empty state without zero-price points', () => {
    render(<PriceHistoryChart points={[]} range="30d" onRangeChange={() => undefined} />);
    for (const range of ['7д', '30д', '90д', 'Всё']) expect(screen.getByRole('button', { name: range })).toBeInTheDocument();
    expect(screen.getByText('История появится после первой успешной проверки')).toBeInTheDocument();
  });
});
