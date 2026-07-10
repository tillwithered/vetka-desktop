import { useEffect, useState, type ReactNode } from 'react';
import { CalculatorIcon, HeartIcon, PackageSearchIcon, RefreshCwIcon, SettingsIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import type { UpdateState } from '@/shared/contracts';

const destinations = [
  { label: 'Избранное', href: '/', icon: HeartIcon },
  { label: 'Куклы', href: '/dolls', icon: PackageSearchIcon },
  { label: 'Заказы', href: '/orders', icon: CalculatorIcon },
  { label: 'Настройки', href: '/settings', icon: SettingsIcon },
] as const;

function UpdateFooter({ version }: { version: string }) {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    let active = true;
    const applyState = (state: UpdateState) => { if (active) setUpdate(state); };
    const unsubscribe = window.vetka.updates.onStateChanged(applyState);
    void window.vetka.updates.getState().then((result) => { if (result.ok) applyState(result.data); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const restart = async () => { await window.vetka.updates.restartAndInstall(); };
  const updateAction = update.status === 'available'
    ? <Button size="xs" disabled><RefreshCwIcon className="animate-spin" />Обновить</Button>
    : update.status === 'downloaded'
      ? <Button size="xs" onClick={() => void restart()}><RefreshCwIcon />Обновить</Button>
      : null;
  return <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"><span>{version ? `Vetka Desktop v${version}` : 'Vetka Desktop'}</span>{updateAction}</div>;
}

function Navigation({ quickAction }: { quickAction: ReactNode }) {
  const location = useLocation();
  const [version, setVersion] = useState('');
  useEffect(() => { void window.vetka.health().then((result) => { if (result.ok) setVersion(result.data.version); }); }, []);
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader><div className="flex items-center gap-2 px-2 py-1"><span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">V</span><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="font-heading text-sm font-semibold">VETKA</p><p className="text-xs text-muted-foreground">рабочее место</p></div></div><div className="px-1 group-data-[collapsible=icon]:hidden">{quickAction}</div></SidebarHeader>
      <SidebarContent><SidebarGroup><SidebarGroupLabel>Работа</SidebarGroupLabel><SidebarGroupContent><nav aria-label="Основная навигация"><SidebarMenu>{destinations.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild size="sm" isActive={location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))} tooltip={item.label}><NavLink to={item.href}><item.icon /><span>{item.label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></nav></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarFooter><UpdateFooter version={version} /></SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children, quickAction }: { children: ReactNode; quickAction: ReactNode }) {
  return <SidebarProvider><Navigation quickAction={quickAction} /><SidebarInset><div className="flex items-center gap-2 px-6 pt-4"><SidebarTrigger aria-label="Открыть или свернуть sidebar" /></div>{children}</SidebarInset></SidebarProvider>;
}
