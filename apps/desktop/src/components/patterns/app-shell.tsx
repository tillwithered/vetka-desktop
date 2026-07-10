import { useEffect, useState, type ReactNode } from 'react';
import { CalculatorIcon, HeartIcon, PackageSearchIcon, SettingsIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const destinations = [
  { label: 'Избранное', href: '/', icon: HeartIcon },
  { label: 'Куклы', href: '/dolls', icon: PackageSearchIcon },
  { label: 'Заказы', href: '/orders', icon: CalculatorIcon },
  { label: 'Настройки', href: '/settings', icon: SettingsIcon },
] as const;

function Navigation({ quickAction }: { quickAction: ReactNode }) {
  const location = useLocation();
  const [version, setVersion] = useState('');
  useEffect(() => { void window.vetka.health().then((result) => { if (result.ok) setVersion(result.data.version); }); }, []);
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1"><span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">V</span><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="font-heading text-sm font-semibold">VETKA</p><p className="text-xs text-muted-foreground">рабочее место</p></div></div>
        <div className="px-1 group-data-[collapsible=icon]:hidden">{quickAction}</div>
      </SidebarHeader>
      <SidebarContent><SidebarGroup><SidebarGroupLabel>Работа</SidebarGroupLabel><SidebarGroupContent><nav aria-label="Основная навигация"><SidebarMenu>{destinations.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild size="sm" isActive={location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))} tooltip={item.label}><NavLink to={item.href}><item.icon /><span>{item.label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></nav></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarFooter><p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{version ? `Vetka Desktop v${version}` : 'Vetka Desktop'}</p></SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children, quickAction }: { children: ReactNode; quickAction: ReactNode }) {
  return <SidebarProvider><Navigation quickAction={quickAction} /><SidebarInset><div className="flex items-center gap-2 px-6 pt-4"><SidebarTrigger aria-label="Открыть или свернуть sidebar" /></div>{children}</SidebarInset></SidebarProvider>;
}
