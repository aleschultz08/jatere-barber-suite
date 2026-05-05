import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Play,
  UserPlus,
} from "lucide-react";
import {
  fetchServices,
  formatGs,
  fetchBarbers,
  fetchBookings,
  addBookingRemote,
  setBarberStatusRemote,
  updateBookingStatusRemote,
  onStoreChange,
  generateSlots,
  isSlotTakenIn,
  getBookingPrice,
  type MockBarber,
  type MockBooking,
  type MockService,
} from "@/lib/barberStore";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Tab = "today" | "upcoming" | "history";

const STATUS_BADGE: Record<MockBooking["status"], { label: string; cls: string }> = {
  confirmed: { label: "Confirmado", cls: "border-gold text-gold" },
  in_progress: { label: "En curso", cls: "border-primary text-primary" },
  completed: { label: "Completado", cls: "border-muted-foreground text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "border-destructive text-destructive" },
};

const BarberDashboard = () => {
  const [barbers, setBarbers] = useState<MockBarber[]>([]);
  const [services, setServices] = useState<MockService[]>([]);
  const [bookings, setBookings] = useState<MockBooking[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("today");
  const [walkinOpen, setWalkinOpen] = useState(false);

  const refresh = () => {
    fetchBarbers().then((list) => {
      setBarbers(list);
      setActiveId((prev) => prev || list[0]?.id || "");
    });
    fetchServices().then(setServices);
    fetchBookings().then(setBookings);
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
    // Solo reservas del barbero activo, en la fecha de hoy.
    const ofToday = bookings.filter((b) => b.barberId === activeId && b.date === today);
    const todayActive = ofToday.filter((b) => b.status !== "cancelled");
    const todayCompleted = ofToday.filter((b) => b.status === "completed");
    // SIEMPRE usar getBookingPrice → cubre price, priceOverride, services[] y fallback.
    const earned = todayCompleted.reduce((sum, b) => sum + getBookingPrice(b), 0);
    const projected = todayActive.reduce((sum, b) => sum + getBookingPrice(b), 0);
    return {
      todayCount: todayActive.length,
      completed: todayCompleted.length,
      earned,
      projected,
    };
    // services en deps → recalcula cuando llega el caché de precios
  }, [bookings, activeId, today, services]);

  const setStatus = async (status: "available" | "busy") => {
    if (!active) return;
    try {
      await setBarberStatusRemote(active.id, status);
      toast.success(status === "available" ? "Marcado como disponible" : "Marcado como ocupado");
    } catch (e: any) {
      toast.error(e.message || "No se pudo actualizar el estado");
    }
  };

  const start = async (id: string) => {
    try {
      await updateBookingStatusRemote(id, "in_progress");
      await fetchBookings().then(setBookings); // refresco explícito → métricas reactivas
      toast.success("Servicio iniciado");
    } catch (e: any) { toast.error("No se pudo iniciar", { description: e?.message }); }
  };
  const finish = async (id: string) => {
    try {
      await updateBookingStatusRemote(id, "completed");
      await fetchBookings().then(setBookings);
      toast.success("Servicio finalizado", { description: "Sumado a tus ingresos del día." });
    } catch (e: any) { toast.error("No se pudo finalizar", { description: e?.message }); }
  };
  const cancel = async (id: string) => {
    if (!window.confirm("¿Cancelar este turno? Se liberará el horario.")) return;
    try {
      await updateBookingStatusRemote(id, "cancelled");
      await fetchBookings().then(setBookings);
      toast.success("Turno cancelado", { description: "Horario liberado." });
    } catch (e: any) { toast.error("No se pudo cancelar", { description: e?.message }); }
  };

  const list = tab === "today" ? todayBookings : tab === "upcoming" ? upcoming : history;

  const renderBookingCard = (b: MockBooking) => {
    const svc = services.find((s) => s.id === b.serviceId);
    const items = b.services && b.services.length > 0
      ? b.services
      : (svc ? [{ id: svc.id, name: svc.name, price: svc.price, duration_min: svc.duration_min }] : []);
    const totalDuration = items.reduce((s, x) => s + (x.duration_min || 0), 0);
    const namesJoined = items.map((s) => s.name).join(" + ") || (b.serviceName ?? "Servicio");
    const badge = STATUS_BADGE[b.status];
    return (
      <div key={b.id} className="p-4 rounded-md border border-border bg-background/30 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="w-4 h-4 text-gold" />
              {b.date === today ? b.time : `${b.date} · ${b.time}`}
            </div>
            <div className="text-sm flex items-center gap-2 text-muted-foreground">
              <Scissors className="w-3.5 h-3.5" /> {namesJoined}
              {totalDuration > 0 && <span className="opacity-60">· ~{totalDuration} min</span>}
            </div>
            <div className="text-sm flex items-center gap-2 text-muted-foreground">
              <User className="w-3.5 h-3.5" /> {b.clientName || "Cliente"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
                {b.source === "walkin" ? "Presencial" : "Online"}
              </Badge>
              <Badge variant="outline" className={cn(badge.cls)}>
                {badge.label}
              </Badge>
            </div>
            <span className="text-gold font-semibold text-sm">{formatGs(getBookingPrice(b))}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {b.status === "confirmed" && (
            <Button size="sm" onClick={() => start(b.id)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Play className="w-4 h-4 mr-1" /> Iniciar
            </Button>
          )}
          {b.status === "in_progress" && (
            <Button size="sm" onClick={() => finish(b.id)} className="bg-gold text-primary-foreground hover:bg-gold/90">
              <Check className="w-4 h-4 mr-1" /> Finalizar
            </Button>
          )}
          {(b.status === "confirmed" || b.status === "in_progress") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancel(b.id)}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          )}
        </div>
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
                className={cn(activeId === b.id && "bg-gold text-primary-foreground hover:bg-gold/90")}
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
                    active.status === "available" ? "border-gold text-gold" : "border-destructive text-destructive",
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
              Cuando estés <span className="text-gold">Disponible</span> los clientes pueden reservar. Si pasás a{" "}
              <span className="text-destructive">Ocupado</span> no se aceptan nuevas reservas online.
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

        {/* Tabs + Walk-in */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
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
          <Button
            onClick={() => setWalkinOpen(true)}
            className="bg-gold text-primary-foreground hover:bg-gold/90"
          >
            <UserPlus className="w-4 h-4 mr-1" /> Cliente sin reserva
          </Button>
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
              <p className="text-sm text-muted-foreground text-center py-6">No hay turnos para mostrar.</p>
            )}
            {list.map(renderBookingCard)}
          </CardContent>
        </Card>
      </div>

      <WalkinDialog
        open={walkinOpen}
        onOpenChange={setWalkinOpen}
        barberId={activeId}
        services={services}
        bookings={bookings}
        date={today}
        onCreated={refresh}
      />
    </DashboardShell>
  );
};

const WalkinDialog = ({
  open,
  onOpenChange,
  barberId,
  services,
  bookings,
  date,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  barberId: string;
  services: MockService[];
  bookings: MockBooking[];
  date: string;
  onCreated: () => void;
}) => {
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [time, setTime] = useState("");
  const [price, setPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const slots = useMemo(() => generateSlots(date), [date]);
  const svc = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (svc) setPrice(String(svc.price));
  }, [serviceId]);

  const reset = () => {
    setName(""); setServiceId(""); setTime(""); setPrice("");
  };

  const submit = async () => {
    if (!barberId) return toast.error("Elegí un barbero");
    if (!serviceId || !svc) return toast.error("Elegí un servicio");
    if (!time) return toast.error("Elegí un horario");
    if (isSlotTakenIn(bookings, barberId, date, time, svc.duration_min)) {
      return toast.error("Horario no disponible", { description: "Ya hay una reserva en ese tiempo." });
    }
    const numericPrice = Number(price);
    setSaving(true);
    try {
      await addBookingRemote({
        barberId,
        serviceId,
        serviceName: svc.name,
        date,
        time,
        durationMin: svc.duration_min,
        price: Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : svc.price,
        clientName: name.trim() || "Cliente presencial",
        source: "walkin",
      });
      toast.success("Cliente agregado", { description: `${svc.name} · ${time}` });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      const msg = e?.message || "";
      if (/horario|reserv|overlap|disponible/i.test(msg)) {
        toast.error("Horario no disponible", { description: "Otra reserva ocupa ese tiempo." });
      } else {
        toast.error("Error al guardar", { description: msg });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">+ Cliente sin reserva</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre (opcional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan" />
          </div>
          <div>
            <Label>Servicio</Label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm"
            >
              <option value="">Elegí un servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatGs(s.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hora</Label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm"
              >
                <option value="">--:--</option>
                {slots.map((t) => {
                  const taken = isSlotTakenIn(bookings, barberId, date, t, svc?.duration_min ?? 30);
                  return (
                    <option key={t} value={t} disabled={taken}>
                      {t} {taken ? "(ocupado)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <Label>Precio (Gs.)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} className="bg-gold text-primary-foreground hover:bg-gold/90">
            Guardar turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
