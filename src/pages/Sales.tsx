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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type LineItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
};

export default function Sales() {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orderTakers, setOrderTakers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    shop_id: '', supplier_id: '', order_taker_id: '',
    order_date: new Date().toISOString().split('T')[0],
    supply_date: '', status: 'draft', notes: '', discount: '0',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const load = async () => {
    if (!tenantId) return;
    const [inv, sh, sup, prod, profiles] = await Promise.all([
      supabase.from('invoices').select('*, shops(name), suppliers(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('shops').select('id, name').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('suppliers').select('id, name').eq('tenant_id', tenantId),
      supabase.from('products').select('id, name, sale_price, current_stock, unit').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('profiles').select('user_id, full_name, user_roles(role)').eq('tenant_id', tenantId),
    ]);
    setInvoices((inv.data || []) as any);
    setShops(sh.data || []);
    setSuppliers(sup.data || []);
    setProducts(prod.data || []);
    // Filter profiles to show order_takers and salesmen
    const ots = (profiles.data || []).filter((p: any) => 
      p.user_roles?.some((r: any) => ['order_taker', 'salesman', 'owner', 'manager'].includes(r.role))
    );
    setOrderTakers(ots);
  };

  useEffect(() => { load(); }, [tenantId]);

  const addLineItem = () => {
    setLineItems([...lineItems, { product_id: '', product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 }]);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.product_name = product.name;
        item.unit_price = Number(product.sale_price);
      }
    }
    
    // Recalculate total: (qty * price) - discount
    item.total = Math.max(0, (item.quantity * item.unit_price) - item.discount);
    updated[index] = item;
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((s, item) => s + item.total, 0);
  const totalDiscount = parseFloat(form.discount) || 0;
  const grandTotal = Math.max(0, subtotal - totalDiscount);

  const handleCreate = async () => {
    if (!tenantId || !user) return;
    if (!form.shop_id) { toast({ title: 'Error', description: 'Please select a shop', variant: 'destructive' }); return; }
    if (lineItems.length === 0) { toast({ title: 'Error', description: 'Add at least one product', variant: 'destructive' }); return; }

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    
    const { data: invoice, error } = await supabase.from('invoices').insert({
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      shop_id: form.shop_id,
      supplier_id: form.supplier_id || null,
      order_taker_id: form.order_taker_id || null,
      order_date: form.order_date,
      supply_date: form.supply_date || null,
      invoice_date: form.order_date,
      subtotal,
      discount: totalDiscount,
      total: grandTotal,
      status: form.status as any,
      notes: form.notes,
      created_by: user.id,
    }).select('id').single();

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // Insert line items
    if (invoice) {
      const items = lineItems.map(li => ({
        invoice_id: invoice.id,
        product_id: li.product_id || null,
        description: li.product_name || 'Item',
        quantity: li.quantity,
        unit_price: li.unit_price,
        discount: li.discount,
        total: li.total,
      }));
      await supabase.from('invoice_items').insert(items);
    }

    toast({ title: 'Invoice created', description: invoiceNumber });
    setOpen(false);
    resetForm();
    load();
  };

  const resetForm = () => {
    setForm({ shop_id: '', supplier_id: '', order_taker_id: '', order_date: new Date().toISOString().split('T')[0], supply_date: '', status: 'draft', notes: '', discount: '0' });
    setLineItems([]);
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground', sent: 'bg-primary/10 text-primary', paid: 'bg-accent/10 text-accent',
    partial: 'bg-yellow-100 text-yellow-800', overdue: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground',
    credit: 'bg-orange-100 text-orange-800',
  };

  const filtered = invoices
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .filter(i => 
      i.invoice_number.toLowerCase().includes(search.toLowerCase()) || 
      (i as any).shops?.name?.toLowerCase()?.includes(search.toLowerCase())
    );

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total), 0);
  const totalPending = invoices.filter(i => ['draft', 'sent', 'partial', 'credit'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales & Invoices</h1>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
            <span>Total: {invoices.length}</span>
            <span>Revenue: ₨ {totalRevenue.toLocaleString()}</span>
            <span className="text-orange-600">Pending: ₨ {totalPending.toLocaleString()}</span>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
            <div className="space-y-5">
              {/* Row 1: Shop & Supplier */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Shop *</Label>
                  <Select value={form.shop_id} onValueChange={v => setForm({ ...form, shop_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                    <SelectContent>{shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: OT & Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Order Taker (OT)</Label>
                  <Select value={form.order_taker_id} onValueChange={v => setForm({ ...form, order_taker_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select OT" /></SelectTrigger>
                    <SelectContent>{orderTakers.map(ot => <SelectItem key={ot.user_id} value={ot.user_id}>{ot.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input type="date" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Supply Date</Label>
                  <Input type="date" value={form.supply_date} onChange={e => setForm({ ...form, supply_date: e.target.value })} />
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Products</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="w-3 h-3 mr-1" /> Add Product
                  </Button>
                </div>

                {lineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                    No products added. Click "Add Product" to start.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs">Product</Label>
                          <Select value={item.product_id} onValueChange={v => updateLineItem(idx, 'product_id', v)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} (₨{p.sale_price}) — {p.current_stock} {p.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min="1" className="h-9" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))} />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Price</Label>
                          <Input type="number" className="h-9" value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', Number(e.target.value))} />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Discount</Label>
                          <Input type="number" className="h-9" value={item.discount} onChange={e => updateLineItem(idx, 'discount', Number(e.target.value))} />
                        </div>
                        <div className="col-span-1 text-right font-medium text-sm pt-5">
                          ₨{item.total.toLocaleString()}
                        </div>
                        <div className="col-span-1 flex justify-end pt-5">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLineItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['draft', 'sent', 'paid', 'partial', 'credit', 'overdue', 'cancelled'].map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₨ {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="text-muted-foreground">Invoice Discount</span>
                    <Input type="number" className="w-28 h-8 text-right" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>₨ {grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Button onClick={handleCreate} className="w-full" size="lg">Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'sent', 'paid', 'partial', 'credit', 'overdue', 'cancelled'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" className="capitalize" onClick={() => setStatusFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by invoice # or shop name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Supply Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>
              ) : filtered.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/shops/${inv.shop_id}`)}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{(inv as any).shops?.name || '—'}</TableCell>
                  <TableCell>{inv.order_date || inv.invoice_date}</TableCell>
                  <TableCell>{inv.supply_date || '—'}</TableCell>
                  <TableCell>₨ {Number(inv.total).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[inv.status] || ''}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Eye className="w-4 h-4 text-muted-foreground" />
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
