import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import {
  SERVICES,
  formatGs,
  getBarbers,
  getBookings,
  setBarberStatus,
  onStoreChange,
  type MockBarber,
  type MockBooking,
} from "@/lib/barberStore";
import { format } from "date-fns";

const BarberDashboard = () => {
  const [barbers, setBarbers] = useState<MockBarber[]>([]);
  const [bookings, setBookings] = useState<MockBooking[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const refresh = () => {
    const list = getBarbers();
    setBarbers(list);
    setBookings(getBookings());
    setActiveId((prev) => prev || list[0]?.id || "");
  };

  useEffect(() => {
    refresh();
    return onStoreChange(refresh);
  }, []);

  const active = barbers.find((b) => b.id === activeId);
  const today = format(new Date(), "yyyy-MM-dd");

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.barberId === activeId)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [bookings, activeId],
  );

  const todayBookings = myBookings.filter((b) => b.date === today);
  const upcoming = myBookings.filter((b) => b.date > today);

  const setStatus = (status: "available" | "busy") => {
    if (!active) return;
    setBarberStatus(active.id, status);
    toast.success(
      status === "available" ? "Marcado como disponible" : "Marcado como ocupado",
    );
  };

  return (
    <DashboardShell title="Panel del barbero">
      <div className="space-y-6">
        {barbers.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {barbers.map((b) => (
              <Button
                key={b.id}
                variant={activeId === b.id ? "default" : "outline"}
                onClick={() => setActiveId(b.id)}
                className={cn(
                  activeId === b.id &&
                    "bg-gold text-primary-foreground hover:bg-gold/90",
                )}
              >
                {b.name}
              </Button>
            ))}
          </div>
        )}

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center justify-between gap-3 flex-wrap">
              <span>Mi estado</span>
              {active && (
                <Badge
                  variant="outline"
                  className={cn(
                    active.status === "available"
                      ? "border-gold text-gold"
                      : "border-destructive text-destructive",
                  )}
                >
                  <Circle
                    className={cn(
                      "w-2 h-2 mr-1 fill-current",
                      active.status === "available" ? "text-gold" : "text-destructive",
                    )}
                  />
                  {active.status === "available" ? "Disponible" : "Ocupado"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Cuando estés <span className="text-gold">Disponible</span>, los clientes
              pueden reservar contigo. Si pasás a{" "}
              <span className="text-destructive">Ocupado</span>, no se aceptan nuevas
              reservas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setStatus("available")}
                disabled={active?.status === "available"}
                className="bg-gold text-primary-foreground hover:bg-gold/90 h-12"
              >
                <Check className="w-4 h-4 mr-2" /> Disponible
              </Button>
              <Button
                onClick={() => setStatus("busy")}
                disabled={active?.status === "busy"}
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10 h-12"
              >
                <Circle className="w-3 h-3 mr-2 fill-current" /> Ocupado
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Turnos de hoy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayBookings.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin turnos para hoy.</p>
            )}
            {todayBookings.map((b) => {
              const svc = SERVICES.find((s) => s.id === b.serviceId);
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div>
                    <div className="font-medium">{b.time}</div>
                    <div className="text-xs text-muted-foreground">
                      {svc?.name} · {b.clientName || "Cliente"}
                    </div>
                  </div>
                  {svc && <span className="text-gold font-semibold">{formatGs(svc.price)}</span>}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Próximos turnos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin próximos turnos.</p>
            )}
            {upcoming.map((b) => {
              const svc = SERVICES.find((s) => s.id === b.serviceId);
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div>
                    <div className="font-medium">
                      {b.date} · {b.time}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {svc?.name} · {b.clientName || "Cliente"}
                    </div>
                  </div>
                  {svc && <span className="text-gold font-semibold">{formatGs(svc.price)}</span>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
};

export default BarberDashboard;
