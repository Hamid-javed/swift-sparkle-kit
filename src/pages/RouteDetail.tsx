import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Store, UserCheck, TruckIcon } from 'lucide-react';

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [route, setRoute] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [assignedOT, setAssignedOT] = useState('');

  const load = async () => {
    if (!tenantId || !id) return;
    const [routeRes, shopsRes, profilesRes] = await Promise.all([
      supabase.from('routes').select('*').eq('id', id).single(),
      supabase.from('shops').select('*').eq('tenant_id', tenantId).eq('route_id', id).order('name'),
      supabase.from('profiles').select('user_id, full_name, user_roles(role)').eq('tenant_id', tenantId),
    ]);
    setRoute(routeRes.data);
    setShops(shopsRes.data || []);
    setAllProfiles(profilesRes.data || []);
    if (routeRes.data?.assigned_to) {
      setAssignedOT(routeRes.data.assigned_to);
    }
  };

  useEffect(() => { load(); }, [tenantId, id]);

  const handleAssignOT = async (userId: string) => {
    setAssignedOT(userId);
    const { error } = await supabase.from('routes').update({ assigned_to: userId }).eq('id', id!);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Route assigned' });
    load();
  };

  const orderTakers = allProfiles.filter((p: any) => 
    p.user_roles?.some((r: any) => ['order_taker', 'salesman'].includes(r.role))
  );

  const assignedProfile = allProfiles.find(p => p.user_id === route?.assigned_to);

  const totalShops = shops.length;
  const activeShops = shops.filter(s => s.is_active).length;

  if (!route) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/routes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{route.name}</h1>
          <p className="text-sm text-muted-foreground">{route.description || 'No description'}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Store className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Shops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeShops} <span className="text-sm font-normal text-muted-foreground">/ {totalShops}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <UserCheck className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned To</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{assignedProfile?.full_name || 'Unassigned'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assign Order Taker / Salesman</CardTitle></CardHeader>
          <CardContent>
            <Select value={assignedOT} onValueChange={handleAssignOT}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {orderTakers.map(ot => (
                  <SelectItem key={ot.user_id} value={ot.user_id}>
                    {ot.full_name} ({ot.user_roles?.[0]?.role?.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Shops on this route */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Shops on this Route</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No shops on this route</TableCell></TableRow>
              ) : shops.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/shops/${s.id}`)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.owner_name || '—'}</TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.address || '—'}</TableCell>
                  <TableCell>
                    {s.is_active
                      ? <Badge variant="secondary" className="bg-accent/10 text-accent">Active</Badge>
                      : <Badge variant="destructive">Inactive</Badge>
                    }
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
