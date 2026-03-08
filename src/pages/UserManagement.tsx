import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function UserManagement() {
  const { tenantId } = useAuth();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*, user_roles(role)').eq('tenant_id', tenantId);
      setUsers(data || []);
    };
    load();
  }, [tenantId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage users in your organization</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
              ) : users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{u.user_roles?.[0]?.role || 'viewer'}</Badge></TableCell>
                  <TableCell>{u.is_active ? <Badge variant="secondary" className="bg-accent/10 text-accent">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
