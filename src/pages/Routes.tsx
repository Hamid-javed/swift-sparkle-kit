import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Routes() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<any[]>([]);
  const [shopCounts, setShopCounts] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = async () => {
    if (!tenantId) return;
    const [routeRes, shopRes, profRes] = await Promise.all([
      supabase.from('routes').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('shops').select('id, route_id').eq('tenant_id', tenantId),
      supabase.from('profiles').select('user_id, full_name').eq('tenant_id', tenantId),
    ]);
    setRoutes(routeRes.data || []);
    setProfiles(profRes.data || []);
    const counts: Record<string, number> = {};
    (shopRes.data || []).forEach((s: any) => { if (s.route_id) counts[s.route_id] = (counts[s.route_id] || 0) + 1; });
    setShopCounts(counts);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId) return;
    const { error } = await supabase.from('routes').insert({ tenant_id: tenantId, name: form.name, description: form.description });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Route added' });
    setOpen(false);
    setForm({ name: '', description: '' });
    load();
  };

  const filtered = routes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const getAssignedName = (assignedTo: string | null) => {
    if (!assignedTo) return '—';
    const profile = profiles.find(p => p.user_id === assignedTo);
    return profile?.full_name || '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routes</h1>
          <p className="text-muted-foreground">{routes.length} routes configured</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Add Route</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Route</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Route Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Route name" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the route" /></div>
              <Button onClick={handleCreate} className="w-full">Add Route</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Shops</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No routes found</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/routes/${r.id}`)}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.description || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{shopCounts[r.id] || 0} shops</Badge>
                  </TableCell>
                  <TableCell>{getAssignedName(r.assigned_to)}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
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
