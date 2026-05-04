import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ClientDashboard = () => (
  <DashboardShell title="Mi panel">
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-display">Bienvenido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">Pronto vas a poder reservar tu turno desde acá.</p>
        <Button className="bg-gold text-primary-foreground hover:bg-gold/90">Próximamente: nueva reserva</Button>
      </CardContent>
    </Card>
  </DashboardShell>
);

export default ClientDashboard;
