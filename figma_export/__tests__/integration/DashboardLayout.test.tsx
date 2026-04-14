import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DashboardLayout } from '@/app/components/layout/DashboardLayout';

describe('DashboardLayout', () => {
  it('renders a mobile-first stacked header with scrollable navigation pills', () => {
    render(
      <MemoryRouter initialEntries={['/logistics']}>
        <DashboardLayout variant="logistics">
          <div>Conteudo</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Frigorifico - Monitoramento/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard de Logistica/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Decisao/i })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation');
    expect(navigation.className).toContain('overflow-x-auto');
    expect(screen.getByRole('link', { name: /Operacional/i }).className).toContain(
      'rounded-full',
    );

    const headerRow = navigation.parentElement;
    expect(headerRow?.className).toContain('flex-col');
  });
});
