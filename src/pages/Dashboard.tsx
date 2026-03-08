import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Receipt, Package, Store, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const { tenantId, profile, roles } = useAuth();
  const [stats, setStats] = useState({ invoices: 0, revenue: 0, expenses: 0, products: 0, shops: 0, lowStock: 0 });

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [inv, exp, prod, shop] = await Promise.all([
        supabase.from('invoices').select('total, status').eq('tenant_id', tenantId),
        supabase.from('expenses').select('amount').eq('tenant_id', tenantId),
        supabase.from('products').select('id, current_stock, min_stock').eq('tenant_id', tenantId),
        supabase.from('shops').select('id').eq('tenant_id', tenantId),
      ]);
      const revenue = (inv.data || []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0);
      const totalExpenses = (exp.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const lowStock = (prod.data || []).filter(p => Number(p.current_stock) <= Number(p.min_stock)).length;
      setStats({
        invoices: inv.data?.length || 0,
        revenue,
        expenses: totalExpenses,
        products: prod.data?.length || 0,
        shops: shop.data?.length || 0,
        lowStock,
      });
    };
    load();
  }, [tenantId]);

  const cards = [
    { title: 'Total Revenue', value: `₨ ${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-accent' },
    { title: 'Total Expenses', value: `₨ ${stats.expenses.toLocaleString()}`, icon: TrendingDown, color: 'text-destructive' },
    { title: 'Invoices', value: stats.invoices, icon: ShoppingCart, color: 'text-primary' },
    { title: 'Products', value: stats.products, icon: Package, color: 'text-primary' },
    { title: 'Shops', value: stats.shops, icon: Store, color: 'text-primary' },
    { title: 'Low Stock Items', value: stats.lowStock, icon: AlertTriangle, color: stats.lowStock > 0 ? 'text-warning' : 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {profile?.full_name}</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.revenue - stats.expenses >= 0 ? 'text-accent' : 'text-destructive'}`}>
              ₨ {(stats.revenue - stats.expenses).toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Revenue minus expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Role:</span> <span className="capitalize font-medium">{roles[0]}</span></p>
            <p><span className="text-muted-foreground">Business modules:</span> Sales, Expenses, Inventory, Routes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
