import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DollTable } from '@/renderer/features/dolls/doll-table';

describe('DollTable', () => {
  it('renders identifiers and the favorite action', () => {
    render(<MemoryRouter><DollTable dolls={[{ id: 'd1', name: 'Draculaura', characterName: 'Draculaura', lineName: 'Core Refresh', generation: 'G3', mattelSku: 'HRP64', upcEan: null, imagePath: null, notes: null, isFavorite: true, createdAt: '', updatedAt: '' }]} onFavorite={vi.fn()} /></MemoryRouter>);
    expect(screen.getAllByText('Draculaura').length).toBeGreaterThan(0);
    expect(screen.getByText('HRP64')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
  });
});
