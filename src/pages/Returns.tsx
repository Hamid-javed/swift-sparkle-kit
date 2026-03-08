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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Trash2 } from 'lucide-react';

type ReturnItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export default function Returns() {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [returns, setReturns] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    shop_id: '', invoice_id: '', reason: '', return_date: new Date().toISOString().split('T')[0],
  });
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  const load = async () => {
    if (!tenantId) return;
    const [ret, sh, inv, prod] = await Promise.all([
      supabase.from('returns').select('*, shops(name), invoices(invoice_number)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('shops').select('id, name').eq('tenant_id', tenantId),
      supabase.from('invoices').select('id, invoice_number, shop_id').eq('tenant_id', tenantId),
      supabase.from('products').select('id, name, sale_price, unit').eq('tenant_id', tenantId),
    ]);
    setReturns(ret.data || []);
    setShops(sh.data || []);
    setInvoices(inv.data || []);
    setProducts(prod.data || []);
  };

  useEffect(() => { load(); }, [tenantId]);

  const addReturnItem = () => {
    setReturnItems([...returnItems, { product_id: '', product_name: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const updateReturnItem = (index: number, field: string, value: any) => {
    const updated = [...returnItems];
    const item = { ...updated[index], [field]: value };
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) { item.product_name = product.name; item.unit_price = Number(product.sale_price); }
    }
    item.total = item.quantity * item.unit_price;
    updated[index] = item;
    setReturnItems(updated);
  };

  const removeReturnItem = (index: number) => setReturnItems(returnItems.filter((_, i) => i !== index));

  const totalRefund = returnItems.reduce((s, item) => s + item.total, 0);

  const handleCreate = async () => {
    if (!tenantId || !user) return;
    if (!form.shop_id) { toast({ title: 'Error', description: 'Select a shop', variant: 'destructive' }); return; }
    if (returnItems.length === 0) { toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' }); return; }

    const { data: ret, error } = await supabase.from('returns').insert({
      tenant_id: tenantId,
      shop_id: form.shop_id,
      invoice_id: form.invoice_id || null,
      return_date: form.return_date,
      reason: form.reason,
      total_refund: totalRefund,
      created_by: user.id,
    }).select('id').single();

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    if (ret) {
      const items = returnItems.map(ri => ({
        return_id: ret.id,
        product_id: ri.product_id || null,
        quantity: ri.quantity,
        unit_price: ri.unit_price,
        total: ri.total,
      }));
      await supabase.from('return_items').insert(items);

      // Restore product stock
      for (const ri of returnItems) {
        if (ri.product_id) {
          const product = products.find(p => p.id === ri.product_id);
          if (product) {
            await supabase.from('products').update({ current_stock: Number(product.current_stock) + ri.quantity }).eq('id', ri.product_id);
          }
        }
      }
    }

    toast({ title: 'Return created' });
    setOpen(false);
    setForm({ shop_id: '', invoice_id: '', reason: '', return_date: new Date().toISOString().split('T')[0] });
    setReturnItems([]);
    load();
  };

  const shopInvoices = invoices.filter(i => i.shop_id === form.shop_id);

  const handleApprove = async (returnId: string) => {
    await supabase.from('returns').update({ status: 'approved' }).eq('id', returnId);
    toast({ title: 'Return approved' });
    load();
  };

  const handleReject = async (returnId: string) => {
    await supabase.from('returns').update({ status: 'rejected' }).eq('id', returnId);
    toast({ title: 'Return rejected' });
    load();
  };

  const filtered = returns.filter(r =>
    (r as any).shops?.name?.toLowerCase()?.includes(search.toLowerCase()) ||
    (r as any).invoices?.invoice_number?.toLowerCase()?.includes(search.toLowerCase()) ||
    r.reason?.toLowerCase()?.includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-accent/10 text-accent',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          <p className="text-muted-foreground">{returns.length} returns recorded</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> New Return</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Return</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Shop *</Label>
                  <Select value={form.shop_id} onValueChange={v => setForm({ ...form, shop_id: v, invoice_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                    <SelectContent>{shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Against Invoice</Label>
                  <Select value={form.invoice_id} onValueChange={v => setForm({ ...form, invoice_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{shopInvoices.map(i => <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Return Date</Label>
                  <Input type="date" value={form.return_date} onChange={e => setForm({ ...form, return_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Damaged, expired, etc." />
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Return Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addReturnItem}>
                    <Plus className="w-3 h-3 mr-1" /> Add Item
                  </Button>
                </div>
                {returnItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">No items added</p>
                ) : (
                  <div className="space-y-2">
                    {returnItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                        <div className="col-span-5 space-y-1">
                          <Label className="text-xs">Product</Label>
                          <Select value={item.product_id} onValueChange={v => updateReturnItem(idx, 'product_id', v)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min="1" className="h-9" value={item.quantity} onChange={e => updateReturnItem(idx, 'quantity', Number(e.target.value))} />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Price</Label>
                          <Input type="number" className="h-9" value={item.unit_price} onChange={e => updateReturnItem(idx, 'unit_price', Number(e.target.value))} />
                        </div>
                        <div className="col-span-2 text-right font-medium text-sm pt-5">₨{item.total.toLocaleString()}</div>
                        <div className="col-span-1 flex justify-end pt-5">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeReturnItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-lg font-bold">
                <span>Total Refund</span>
                <span>₨ {totalRefund.toLocaleString()}</span>
              </div>

              <Button onClick={handleCreate} className="w-full">Create Return</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search returns..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No returns found</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.return_date}</TableCell>
                  <TableCell>{(r as any).shops?.name || '—'}</TableCell>
                  <TableCell>{(r as any).invoices?.invoice_number || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.reason || '—'}</TableCell>
                  <TableCell className="font-medium">₨ {Number(r.total_refund).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[r.status] || ''}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleApprove(r.id)}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleReject(r.id)}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
