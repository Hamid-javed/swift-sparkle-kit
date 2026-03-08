import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  const { profile, roles, tenantId } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and business settings</p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{profile?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium capitalize">{roles[0]}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tenant ID</span><span className="font-mono text-xs">{tenantId?.slice(0, 8)}...</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
