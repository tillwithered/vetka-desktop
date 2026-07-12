import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/patterns/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AddDollDialog } from '@/renderer/features/dolls/add-doll-dialog';
import { DollDetailPage } from '@/renderer/features/dolls/doll-detail-page';
import { DollsPage } from '@/renderer/features/dolls/dolls-page';
import { HomePage } from '@/renderer/features/home/home-page';
import { OrderDetailPage } from '@/renderer/features/orders/order-detail-page';
import { OrdersPage } from '@/renderer/features/orders/orders-page';
import { SettingsPage } from '@/renderer/features/settings/settings-page';
import { CollectiblesPage } from '@/renderer/features/collectibles/collectibles-page';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 10_000 } } });

function Shell() {
  return <AppShell quickAction={<AddDollDialog />}><Routes><Route path="/" element={<HomePage />} /><Route path="/dolls" element={<DollsPage />} /><Route path="/dolls/:id" element={<DollDetailPage />} /><Route path="/collectibles" element={<CollectiblesPage />} /><Route path="/orders" element={<OrdersPage />} /><Route path="/orders/:id" element={<OrderDetailPage />} /><Route path="/settings" element={<SettingsPage />} /></Routes></AppShell>;
}

export function App() {
  return <QueryClientProvider client={queryClient}><HashRouter><TooltipProvider><Shell /><Toaster richColors /></TooltipProvider></HashRouter></QueryClientProvider>;
}
