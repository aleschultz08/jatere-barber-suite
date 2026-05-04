import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminDashboard = () => (
  <DashboardShell title="Administración">
    <Card className="bg-card border-border">
      <CardHeader><CardTitle className="font-display">Panel admin</CardTitle></CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Próximamente: barberos, servicios, reservas e ingresos.</p>
      </CardContent>
    </Card>
  </DashboardShell>
);

export default AdminDashboard;
