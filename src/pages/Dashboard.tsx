import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Receipt, Package, Store, TrendingDown, DollarSign, AlertTriangle, RotateCcw, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { tenantId, profile, roles } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ invoices: 0, revenue: 0, expenses: 0, products: 0, shops: 0, lowStock: 0, pendingAmount: 0, returns: 0, returnAmount: 0 });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [inv, exp, prod, shop, ret] = await Promise.all([
        supabase.from('invoices').select('*, shops(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('expenses').select('amount').eq('tenant_id', tenantId),
        supabase.from('products').select('id, name, current_stock, min_stock, unit').eq('tenant_id', tenantId),
        supabase.from('shops').select('id').eq('tenant_id', tenantId),
        supabase.from('returns').select('total_refund, status').eq('tenant_id', tenantId),
      ]);
      const invoices = inv.data || [];
      const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0);
      const pendingAmount = invoices.filter(i => ['draft', 'sent', 'partial', 'credit'].includes(i.status))
        .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);
      const totalExpenses = (exp.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const products = prod.data || [];
      const lowStock = products.filter(p => Number(p.current_stock) <= Number(p.min_stock));
      const approvedReturns = (ret.data || []).filter(r => r.status === 'approved');
      
      setStats({
        invoices: invoices.length,
        revenue,
        expenses: totalExpenses,
        products: products.length,
        shops: shop.data?.length || 0,
        lowStock: lowStock.length,
        pendingAmount,
        returns: (ret.data || []).length,
        returnAmount: approvedReturns.reduce((s, r) => s + Number(r.total_refund), 0),
      });
      setRecentInvoices(invoices.slice(0, 5));
      setLowStockProducts(lowStock.slice(0, 5));
    };
    load();
  }, [tenantId]);

  const cards = [
    { title: 'Total Revenue', value: `₨ ${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-accent' },
    { title: 'Pending Receivables', value: `₨ ${stats.pendingAmount.toLocaleString()}`, icon: CreditCard, color: 'text-orange-600' },
    { title: 'Total Expenses', value: `₨ ${stats.expenses.toLocaleString()}`, icon: TrendingDown, color: 'text-destructive' },
    { title: 'Returns', value: `₨ ${stats.returnAmount.toLocaleString()}`, icon: RotateCcw, color: 'text-orange-600', subtitle: `${stats.returns} total` },
    { title: 'Products', value: stats.products, icon: Package, color: 'text-primary' },
    { title: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: stats.lowStock > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground', paid: 'bg-accent/10 text-accent',
    partial: 'bg-yellow-100 text-yellow-800', credit: 'bg-orange-100 text-orange-800',
    overdue: 'bg-destructive/10 text-destructive',
  };

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
              {'subtitle' in card && <p className="text-xs text-muted-foreground">{(card as any).subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Net Profit */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Net Profit</CardTitle></CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${stats.revenue - stats.expenses - stats.returnAmount >= 0 ? 'text-accent' : 'text-destructive'}`}>
            ₨ {(stats.revenue - stats.expenses - stats.returnAmount).toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Revenue − Expenses − Returns</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Invoices</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No invoices yet</TableCell></TableRow>
                ) : recentInvoices.map(inv => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/shops/${inv.shop_id}`)}>
                    <TableCell className="font-medium text-sm">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{(inv as any).shops?.name || '—'}</TableCell>
                    <TableCell className="text-sm">₨ {Number(inv.total).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${statusColors[inv.status] || ''}`}>{inv.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Low Stock Alert</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Minimum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">All stocked up!</TableCell></TableRow>
                ) : lowStockProducts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="text-sm text-destructive font-medium">{p.current_stock} {p.unit}</TableCell>
                    <TableCell className="text-sm">{p.min_stock} {p.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
