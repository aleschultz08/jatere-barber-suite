import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Check,
  Circle,
  X,
  Clock,
  CalendarDays,
  DollarSign,
  Scissors,
  History,
  User,
} from "lucide-react";
import {
  SERVICES,
  formatGs,
  getBarbers,
  getBookings,
  setBarberStatus,
  updateBookingStatus,
  onStoreChange,
  type MockBarber,
  type MockBooking,
} from "@/lib/barberStore";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Tab = "today" | "upcoming" | "history";

const STATUS_BADGE: Record<MockBooking["status"], { label: string; cls: string }> = {
  confirmed: { label: "Confirmado", cls: "border-gold text-gold" },
  completed: { label: "Completado", cls: "border-muted-foreground text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "border-destructive text-destructive" },
};

const BarberDashboard = () => {
  const [barbers, setBarbers] = useState<MockBarber[]>([]);
  const [bookings, setBookings] = useState<MockBooking[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("today");

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
  const history = [...myBookings]
    .filter((b) => b.date < today || b.status === "completed" || b.status === "cancelled")
    .reverse();

  const stats = useMemo(() => {
    const todayActive = todayBookings.filter((b) => b.status !== "cancelled");
    const todayCompleted = todayBookings.filter((b) => b.status === "completed");
    const earned = todayCompleted.reduce((sum, b) => {
      const svc = SERVICES.find((s) => s.id === b.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    const projected = todayActive.reduce((sum, b) => {
      const svc = SERVICES.find((s) => s.id === b.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    return {
      todayCount: todayActive.length,
      completed: todayCompleted.length,
      earned,
      projected,
    };
  }, [todayBookings]);

  const setStatus = (status: "available" | "busy") => {
    if (!active) return;
    setBarberStatus(active.id, status);
    toast.success(
      status === "available" ? "Marcado como disponible" : "Marcado como ocupado",
    );
  };

  const markCompleted = (id: string) => {
    updateBookingStatus(id, "completed");
    toast.success("Turno marcado como completado");
  };

  const markCancelled = (id: string) => {
    updateBookingStatus(id, "cancelled");
    toast.success("Turno cancelado");
  };

  const list = tab === "today" ? todayBookings : tab === "upcoming" ? upcoming : history;

  const renderBookingCard = (b: MockBooking) => {
    const svc = SERVICES.find((s) => s.id === b.serviceId);
    const badge = STATUS_BADGE[b.status];
    const canAct = b.status === "confirmed";
    return (
      <div
        key={b.id}
        className="p-4 rounded-md border border-border bg-background/30 space-y-3"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="w-4 h-4 text-gold" />
              {b.date === today ? b.time : `${b.date} · ${b.time}`}
            </div>
            <div className="text-sm flex items-center gap-2 text-muted-foreground">
              <Scissors className="w-3.5 h-3.5" /> {svc?.name}
              {svc && <span className="opacity-60">· ~{svc.duration_min} min</span>}
            </div>
            <div className="text-sm flex items-center gap-2 text-muted-foreground">
              <User className="w-3.5 h-3.5" /> {b.clientName || "Cliente"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={cn(badge.cls)}>
              {badge.label}
            </Badge>
            {svc && <span className="text-gold font-semibold text-sm">{formatGs(svc.price)}</span>}
          </div>
        </div>
        {canAct && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => markCompleted(b.id)}
              className="bg-gold text-primary-foreground hover:bg-gold/90 flex-1"
            >
              <Check className="w-4 h-4 mr-1" /> Completar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => markCancelled(b.id)}
              className="border-destructive text-destructive hover:bg-destructive/10 flex-1"
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        )}
      </div>
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

        {/* Estado */}
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<CalendarDays className="w-4 h-4" />} label="Hoy" value={String(stats.todayCount)} />
          <StatCard icon={<Check className="w-4 h-4" />} label="Completados" value={String(stats.completed)} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Ingresos" value={formatGs(stats.earned)} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Proyectado" value={formatGs(stats.projected)} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <TabBtn active={tab === "today"} onClick={() => setTab("today")} icon={<CalendarDays className="w-4 h-4" />}>
            Hoy ({todayBookings.length})
          </TabBtn>
          <TabBtn active={tab === "upcoming"} onClick={() => setTab("upcoming")} icon={<Clock className="w-4 h-4" />}>
            Próximos ({upcoming.length})
          </TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<History className="w-4 h-4" />}>
            Historial
          </TabBtn>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {tab === "today" && `Agenda de hoy · ${format(new Date(), "PPP", { locale: es })}`}
              {tab === "upcoming" && "Próximos turnos"}
              {tab === "history" && "Historial"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay turnos para mostrar.
              </p>
            )}
            {list.map(renderBookingCard)}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
        <span className="text-gold">{icon}</span> {label}
      </div>
      <div className="text-lg font-display font-semibold text-foreground truncate">{value}</div>
    </CardContent>
  </Card>
);

const TabBtn = ({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) => (
  <Button
    variant={active ? "default" : "outline"}
    onClick={onClick}
    size="sm"
    className={cn(active && "bg-gold text-primary-foreground hover:bg-gold/90")}
  >
    {icon}
    <span className="ml-1">{children}</span>
  </Button>
);

export default BarberDashboard;
