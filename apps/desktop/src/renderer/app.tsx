import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalculatorIcon, HeartIcon, PackageSearchIcon, SettingsIcon } from 'lucide-react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DollsPage } from '@/renderer/features/dolls/dolls-page';
import { DollDetailPage } from '@/renderer/features/dolls/doll-detail-page';
import { HomePage } from '@/renderer/features/home/home-page';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 10_000 } } });
const destinations = [
  { label: 'Избранное', href: '/', icon: HeartIcon },
  { label: 'Куклы', href: '/dolls', icon: PackageSearchIcon },
  { label: 'Заказы', href: '/orders', icon: CalculatorIcon },
  { label: 'Настройки', href: '/settings', icon: SettingsIcon },
] as const;

function Navigation() {
  const location = useLocation();
  return <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader><Card size="sm"><CardHeader><CardTitle>VETKA</CardTitle><CardDescription>рабочее место</CardDescription></CardHeader></Card></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupLabel>Работа</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{destinations.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))} tooltip={item.label}><NavLink to={item.href}><item.icon /><span>{item.label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    <SidebarFooter><p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Данные хранятся на этом компьютере</p></SidebarFooter>
  </Sidebar>;
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <section className="flex flex-1 flex-col gap-6 p-6"><div><h1 className="text-2xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div><Card><CardHeader><CardTitle>Раздел подключается</CardTitle><CardDescription>Локальная база уже готова.</CardDescription></CardHeader></Card></section>;
}

function Shell() {
  return <SidebarProvider><Navigation /><SidebarInset><div className="sticky top-0 z-20 flex h-12 items-center border-b bg-background/95 px-4 backdrop-blur"><SidebarTrigger /></div><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/dolls" element={<DollsPage />} />
    <Route path="/dolls/:id" element={<DollDetailPage />} />
    <Route path="/orders" element={<PlaceholderPage title="Заказы" description="Себестоимость, контакты и статусы" />} />
    <Route path="/settings" element={<PlaceholderPage title="Настройки" description="Курсы, доставка и резервные копии" />} />
  </Routes></SidebarInset></SidebarProvider>;
}

export function App() {
  return <QueryClientProvider client={queryClient}><HashRouter><TooltipProvider><Shell /><Toaster richColors /></TooltipProvider></HashRouter></QueryClientProvider>;
}
