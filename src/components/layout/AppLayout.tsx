import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ShoppingCart, Receipt, Package, Store, Route, Users,
  Settings, LogOut, Menu, X, ChevronLeft, TruckIcon, ClipboardList, RotateCcw, UserCheck
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'salesman', 'accountant', 'viewer', 'order_taker'] },
  { path: '/sales', label: 'Sales & Invoices', icon: ShoppingCart, roles: ['owner', 'manager', 'salesman', 'order_taker'] },
  { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['owner', 'manager', 'accountant'] },
  { path: '/inventory', label: 'Inventory', icon: Package, roles: ['owner', 'manager'] },
  { path: '/shops', label: 'Shops', icon: Store, roles: ['owner', 'manager', 'salesman', 'order_taker'] },
  { path: '/routes', label: 'Routes', icon: Route, roles: ['owner', 'manager', 'salesman', 'order_taker'] },
  { path: '/suppliers', label: 'Suppliers', icon: TruckIcon, roles: ['owner', 'manager'] },
  { path: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, roles: ['owner', 'manager'] },
  { path: '/returns', label: 'Returns', icon: RotateCcw, roles: ['owner', 'manager', 'salesman', 'order_taker'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['owner'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'manager'] },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredNav = navItems.filter(item => item.roles.some(r => roles.includes(r as any)));

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        "fixed md:relative z-50 flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        sidebarOpen ? "w-64" : "w-16",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className={cn("flex items-center h-16 px-4 border-b border-sidebar-border", sidebarOpen ? "justify-between" : "justify-center")}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Package className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">BizCore</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hidden md:flex h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <ChevronLeft className={cn("w-4 h-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent md:hidden h-8 w-8" onClick={() => setMobileOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {filteredNav.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  "flex items-center w-full rounded-lg text-sm font-medium transition-colors",
                  sidebarOpen ? "px-3 py-2.5 gap-3" : "justify-center p-2.5",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold">
                {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{roles[0]?.replace('_', ' ')}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" className="w-full text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut} title="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center px-4 md:px-6 gap-4 bg-card">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
