import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, CreditCard, Banknote, RotateCcw } from 'lucide-react';

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ invoice_id: '', amount: '', payment_method: 'cash', reference: '' });

  const load = async () => {
    if (!tenantId || !id) return;
    const [shopRes, invRes, payRes, retRes] = await Promise.all([
      supabase.from('shops').select('*, routes(name)').eq('id', id).single(),
      supabase.from('invoices').select('*').eq('tenant_id', tenantId).eq('shop_id', id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*, invoices(invoice_number)').eq('tenant_id', tenantId),
      supabase.from('returns').select('*').eq('tenant_id', tenantId).eq('shop_id', id).order('created_at', { ascending: false }),
    ]);
    setShop(shopRes.data);
    setInvoices(invRes.data || []);
    // Filter payments to this shop's invoices
    const shopInvoiceIds = (invRes.data || []).map((i: any) => i.id);
    setPayments((payRes.data || []).filter((p: any) => shopInvoiceIds.includes(p.invoice_id)));
    setReturns(retRes.data || []);
  };

  useEffect(() => { load(); }, [tenantId, id]);

  const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalReturns = returns.reduce((s, r) => s + Number(r.total_refund), 0);
  const outstandingBalance = totalSales - totalPaid - totalReturns;

  const filtered = invoices
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .filter(i => {
      if (dateFrom && i.invoice_date < dateFrom) return false;
      if (dateTo && i.invoice_date > dateTo) return false;
      return true;
    });

  const handlePayment = async () => {
    if (!tenantId || !user) return;
    const { error } = await supabase.from('payments').insert({
      tenant_id: tenantId,
      invoice_id: payForm.invoice_id || null,
      amount: parseFloat(payForm.amount) || 0,
      payment_method: payForm.payment_method,
      reference: payForm.reference,
      received_by: user.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // If paying against an invoice, update its status and amount_paid
    if (payForm.invoice_id) {
      const invoice = invoices.find(i => i.id === payForm.invoice_id);
      if (invoice) {
        const newPaid = Number(invoice.amount_paid) + (parseFloat(payForm.amount) || 0);
        const newStatus = newPaid >= Number(invoice.total) ? 'paid' : 'partial';
        await supabase.from('invoices').update({ amount_paid: newPaid, status: newStatus }).eq('id', payForm.invoice_id);
      }
    }

    toast({ title: 'Payment recorded' });
    setPayOpen(false);
    setPayForm({ invoice_id: '', amount: '', payment_method: 'cash', reference: '' });
    load();
  };

  const downloadInvoiceCSV = () => {
    const headers = ['Invoice #', 'Date', 'Total', 'Paid', 'Status'];
    const rows = filtered.map(i => [i.invoice_number, i.invoice_date, i.total, i.amount_paid, i.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop?.name || 'shop'}-invoices.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground', sent: 'bg-primary/10 text-primary', paid: 'bg-accent/10 text-accent',
    partial: 'bg-yellow-100 text-yellow-800', overdue: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground',
    credit: 'bg-orange-100 text-orange-800',
  };

  if (!shop) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shops')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{shop.name}</h1>
          <p className="text-sm text-muted-foreground">
            {shop.owner_name && `Owner: ${shop.owner_name}`}
            {shop.phone && ` • ${shop.phone}`}
            {shop.routes?.name && ` • Route: ${shop.routes.name}`}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">₨ {totalSales.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-accent">₨ {totalPaid.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Returns</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">₨ {totalReturns.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Outstanding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">₨ {outstandingBalance.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* Credit Info */}
      {(shop.credit_limit > 0 || shop.credit_balance > 0) && (
        <Card>
          <CardContent className="py-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Credit Limit:</span>
              <span className="font-medium">₨ {Number(shop.credit_limit).toLocaleString()}</span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Credit Used:</span>
              <span className="font-medium text-orange-600">₨ {Number(shop.credit_balance).toLocaleString()}</span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Available:</span>
              <span className="font-medium text-accent">₨ {(Number(shop.credit_limit) - Number(shop.credit_balance)).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Banknote className="w-4 h-4 mr-2" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Against Invoice (optional)</Label>
                <Select value={payForm.invoice_id} onValueChange={v => setPayForm({ ...payForm, invoice_id: v })}>
                  <SelectTrigger><SelectValue placeholder="General payment" /></SelectTrigger>
                  <SelectContent>
                    {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.invoice_number} — ₨{Number(i.total).toLocaleString()} (Paid: ₨{Number(i.amount_paid).toLocaleString()})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₨)</Label>
                  <Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={payForm.payment_method} onValueChange={v => setPayForm({ ...payForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['cash', 'cheque', 'bank_transfer', 'online'].map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reference / Note</Label>
                <Input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Cheque #, receipt #, etc." />
              </div>
              <Button onClick={handlePayment} className="w-full">Record Payment</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={downloadInvoiceCSV}>
          <Download className="w-4 h-4 mr-2" /> Download CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex gap-2 flex-wrap flex-1">
              {['all', 'draft', 'sent', 'paid', 'partial', 'credit', 'overdue'].map(s => (
                <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" className="capitalize" onClick={() => setStatusFilter(s)}>
                  {s}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input type="date" className="w-36 h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" className="w-36 h-9" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>
              ) : filtered.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell>₨ {Number(inv.total).toLocaleString()}</TableCell>
                  <TableCell>₨ {Number(inv.amount_paid).toLocaleString()}</TableCell>
                  <TableCell className={Number(inv.total) - Number(inv.amount_paid) > 0 ? 'text-destructive font-medium' : ''}>
                    ₨ {(Number(inv.total) - Number(inv.amount_paid)).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[inv.status] || ''}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Payment History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{(p as any).invoices?.invoice_number || 'General'}</TableCell>
                    <TableCell className="capitalize">{p.payment_method.replace('_', ' ')}</TableCell>
                    <TableCell>{p.reference || '—'}</TableCell>
                    <TableCell className="font-medium text-accent">₨ {Number(p.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Returns */}
      {returns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Returns</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Refund</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.return_date}</TableCell>
                    <TableCell>{r.reason || '—'}</TableCell>
                    <TableCell className="font-medium">₨ {Number(r.total_refund).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
