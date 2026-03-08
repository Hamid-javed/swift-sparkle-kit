import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search } from 'lucide-react';

type Invoice = {
  id: string; invoice_number: string; shop_id: string | null; invoice_date: string;
  total: number; status: string; created_at: string;
  shops?: { name: string } | null;
};

export default function Sales() {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoice_number: '', shop_id: '', invoice_date: new Date().toISOString().split('T')[0], total: '', status: 'draft', notes: '' });

  const load = async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('invoices').select('*, shops(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setInvoices((data || []) as any);
    const { data: s } = await supabase.from('shops').select('id, name').eq('tenant_id', tenantId);
    setShops(s || []);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId || !user) return;
    const { error } = await supabase.from('invoices').insert({
      tenant_id: tenantId,
      invoice_number: form.invoice_number || `INV-${Date.now()}`,
      shop_id: form.shop_id || null,
      invoice_date: form.invoice_date,
      total: parseFloat(form.total) || 0,
      subtotal: parseFloat(form.total) || 0,
      status: form.status as any,
      notes: form.notes,
      created_by: user.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Invoice created' });
    setOpen(false);
    setForm({ invoice_number: '', shop_id: '', invoice_date: new Date().toISOString().split('T')[0], total: '', status: 'draft', notes: '' });
    load();
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground', sent: 'bg-primary/10 text-primary', paid: 'bg-accent/10 text-accent',
    partial: 'bg-warning/10 text-warning', overdue: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground',
  };

  const filtered = invoices.filter(i => i.invoice_number.toLowerCase().includes(search.toLowerCase()) || (i as any).shops?.name?.toLowerCase()?.includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales & Invoices</h1>
          <p className="text-muted-foreground">Manage your sales and invoices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-001" />
              </div>
              <div className="space-y-2">
                <Label>Shop</Label>
                <Select value={form.shop_id} onValueChange={v => setForm({ ...form, shop_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                  <SelectContent>{shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Total (₨)</Label>
                  <Input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['draft','sent','paid','partial','overdue','cancelled'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full">Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>
              ) : filtered.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{(inv as any).shops?.name || '—'}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell>₨ {Number(inv.total).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={statusColors[inv.status]}>{inv.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
