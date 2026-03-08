import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search } from 'lucide-react';

export default function PurchaseOrders() {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ order_number: '', supplier_id: '', total: '', notes: '' });

  const load = async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('purchase_orders').select('*, suppliers(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setOrders(data || []);
    const { data: s } = await supabase.from('suppliers').select('id, name').eq('tenant_id', tenantId);
    setSuppliers(s || []);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId || !user) return;
    const { error } = await supabase.from('purchase_orders').insert({
      tenant_id: tenantId, order_number: form.order_number || `PO-${Date.now()}`,
      supplier_id: form.supplier_id || null, total: parseFloat(form.total) || 0,
      notes: form.notes, created_by: user.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Purchase order created' });
    setOpen(false);
    setForm({ order_number: '', supplier_id: '', total: '', notes: '' });
    load();
  };

  const filtered = orders.filter(o => o.order_number.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">{orders.length} orders</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> New PO</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Order Number</Label><Input value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })} placeholder="PO-001" /></div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Total (₨)</Label><Input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} /></div>
              <Button onClick={handleCreate} className="w-full">Create PO</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No purchase orders found</TableCell></TableRow>
              ) : filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.order_number}</TableCell>
                  <TableCell>{o.suppliers?.name || '—'}</TableCell>
                  <TableCell>{o.order_date}</TableCell>
                  <TableCell>₨ {Number(o.total).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{o.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
