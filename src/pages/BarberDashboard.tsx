import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BarberDashboard = () => (
  <DashboardShell title="Panel del barbero">
    <Card className="bg-card border-border">
      <CardHeader><CardTitle className="font-display">Tu agenda</CardTitle></CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Próximamente: agenda diaria y gestión de turnos.</p>
      </CardContent>
    </Card>
  </DashboardShell>
);

export default BarberDashboard;
