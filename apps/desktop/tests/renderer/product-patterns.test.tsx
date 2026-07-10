import { render, screen } from '@testing-library/react';
import { PlusIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/patterns/empty-state';
import { FormSection } from '@/components/patterns/form-section';
import { PageHeader } from '@/components/patterns/page-header';
import { PageToolbar } from '@/components/patterns/page-toolbar';

describe('product UI patterns', () => {
  it('renders a compact page header with a content-sized action', () => {
    render(<PageHeader title="Куклы" description="Рабочий список" actions={<button type="button">Добавить куклу</button>} />);
    expect(screen.getByRole('heading', { name: 'Куклы' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить куклу' })).toBeInTheDocument();
  });

  it('keeps toolbar controls and bounded empty-state action semantic', () => {
    render(<><PageToolbar><input aria-label="Поиск" /></PageToolbar><EmptyState icon={PlusIcon} title="Пока пусто" description="Добавьте первую куклу" action={<button type="button">Добавить куклу</button>} /></>);
    expect(screen.getByRole('textbox', { name: 'Поиск' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Пока пусто' })).toBeInTheDocument();
  });

  it('groups a short settings form under one labelled section', () => {
    render(<FormSection title="Доставка" description="Значения для нового заказа"><input aria-label="Вес" /></FormSection>);
    expect(screen.getByRole('heading', { name: 'Доставка' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Вес' })).toBeInTheDocument();
  });
});
