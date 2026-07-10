import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RegionalOfferList } from '@/renderer/features/prices/regional-offer-list';

describe('RegionalOfferList', () => {
  it('always represents all five Amazon regions', () => {
    render(<RegionalOfferList prices={[]} />);
    for (const label of ['Amazon US', 'Amazon UK', 'Amazon DE', 'Amazon ES', 'Amazon IT']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getAllByText('Нет подтверждённой цены')).toHaveLength(5);
  });
});
