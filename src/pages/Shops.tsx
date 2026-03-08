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
import { Plus, Search, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Shops() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [shops, setShops] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', owner_name: '', phone: '', address: '', route_id: '', credit_limit: '0' });

  const load = async () => {
    if (!tenantId) return;
    const [shopRes, routeRes] = await Promise.all([
      supabase.from('shops').select('*, routes(name)').eq('tenant_id', tenantId).order('name'),
      supabase.from('routes').select('id, name').eq('tenant_id', tenantId),
    ]);
    setShops(shopRes.data || []);
    setRoutes(routeRes.data || []);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId) return;
    const { error } = await supabase.from('shops').insert({
      tenant_id: tenantId,
      name: form.name,
      owner_name: form.owner_name,
      phone: form.phone,
      address: form.address,
      route_id: form.route_id || null,
      credit_limit: parseFloat(form.credit_limit) || 0,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Shop added' });
    setOpen(false);
    setForm({ name: '', owner_name: '', phone: '', address: '', route_id: '', credit_limit: '0' });
    load();
  };

  const filtered = shops.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.owner_name?.toLowerCase()?.includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shops</h1>
          <p className="text-muted-foreground">{shops.length} shops registered</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Add Shop</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Shop</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Shop Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Shop name" /></div>
              <div className="space-y-2"><Label>Owner Name</Label><Input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="03XX-XXXXXXX" /></div>
                <div className="space-y-2">
                  <Label>Route</Label>
                  <Select value={form.route_id} onValueChange={v => setForm({ ...form, route_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                    <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Address" /></div>
                <div className="space-y-2"><Label>Credit Limit (₨)</Label><Input type="number" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} /></div>
              </div>
              <Button onClick={handleCreate} className="w-full">Add Shop</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search shops..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No shops found</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/shops/${s.id}`)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.owner_name || '—'}</TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell>{s.routes?.name || '—'}</TableCell>
                  <TableCell>₨ {Number(s.credit_limit || 0).toLocaleString()}</TableCell>
                  <TableCell className={Number(s.credit_balance || 0) > 0 ? 'text-orange-600 font-medium' : ''}>
                    ₨ {Number(s.credit_balance || 0).toLocaleString()}
                  </TableCell>
                  <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
