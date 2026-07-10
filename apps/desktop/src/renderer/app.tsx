import {
  CalculatorIcon,
  HeartIcon,
  PackageSearchIcon,
  SettingsIcon,
} from 'lucide-react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

const destinations = [
  { label: 'Избранное', href: '/', icon: HeartIcon },
  { label: 'Куклы', href: '/dolls', icon: PackageSearchIcon },
  { label: 'Заказы', href: '/orders', icon: CalculatorIcon },
  { label: 'Настройки', href: '/settings', icon: SettingsIcon },
] as const;

function Navigation() {
  const location = useLocation();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <Card size="sm">
          <CardHeader>
            <CardTitle>VETKA</CardTitle>
            <CardDescription>Amazon workspace</CardDescription>
          </CardHeader>
        </Card>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Работа</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {destinations.map((destination) => (
                <SidebarMenuItem key={destination.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === destination.href}
                    tooltip={destination.label}
                  >
                    <NavLink to={destination.href}>
                      <destination.icon />
                      <span>{destination.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <SidebarTrigger />
        <div>
          <h1 className="font-heading text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Рабочее пространство готово</CardTitle>
          <CardDescription>Локальные данные будут доступны даже без сети.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Следующий шаг — подключить SQLite и предметные действия.
        </CardContent>
      </Card>
    </section>
  );
}

function Shell() {
  return (
    <SidebarProvider>
      <Navigation />
      <SidebarInset>
        <Routes>
          <Route path="/" element={<PlaceholderPage title="Рабочий стол" description="Цены, изменения и быстрые действия" />} />
          <Route path="/dolls" element={<PlaceholderPage title="Куклы" description="Рабочий список Amazon" />} />
          <Route path="/orders" element={<PlaceholderPage title="Заказы" description="Себестоимость и статусы" />} />
          <Route path="/settings" element={<PlaceholderPage title="Настройки" description="Регионы, доставка и резервные копии" />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <TooltipProvider>
        <Shell />
      </TooltipProvider>
    </HashRouter>
  );
}
