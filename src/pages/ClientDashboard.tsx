import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock, Scissors, User, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SERVICES,
  formatGs,
  fetchBarbers,
  getBookings,
  addBooking,
  removeBooking,
  onStoreChange,
  generateSlots,
  isSlotTaken,
  type MockBarber,
  type MockBooking,
} from "@/lib/barberStore";

const ClientDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"new" | "mine">("new");

  const [barbers, setBarbers] = useState<MockBarber[]>([]);
  const [bookings, setBookings] = useState<MockBooking[]>([]);

  const [serviceId, setServiceId] = useState<string>("");
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);

  const refresh = () => {
    setBarbers(getBarbers());
    setBookings(getBookings());
  };

  useEffect(() => {
    refresh();
    return onStoreChange(refresh);
  }, []);

  const service = SERVICES.find((s) => s.id === serviceId);
  const selectedBarber = barbers.find((b) => b.id === barberId);
  const dateKey = date ? format(date, "yyyy-MM-dd") : "";

  const allSlots = useMemo(() => generateSlots(dateKey || undefined), [dateKey]);

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.clientName === (user?.email ?? ""))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [bookings, user],
  );

  const submit = () => {
    if (!user || !service || !selectedBarber || !date || !slot) return;
    if (selectedBarber.status === "busy") {
      toast.error("Este barbero está marcado como ocupado.");
      return;
    }
    if (isSlotTaken(selectedBarber.id, dateKey, slot)) {
      toast.error("Ese horario ya fue reservado.");
      return;
    }
    addBooking({
      barberId: selectedBarber.id,
      serviceId: service.id,
      date: dateKey,
      time: slot,
      clientName: user.email ?? "",
    });
    toast.success("¡Turno reservado!");
    setSlot(null);
    setServiceId("");
    setDate(undefined);
    setTab("mine");
  };

  return (
    <DashboardShell title="Mi panel">
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "new" ? "default" : "outline"}
          onClick={() => setTab("new")}
          className={cn(tab === "new" && "bg-gold text-primary-foreground hover:bg-gold/90")}
        >
          Nueva reserva
        </Button>
        <Button
          variant={tab === "mine" ? "default" : "outline"}
          onClick={() => setTab("mine")}
          className={cn(tab === "mine" && "bg-gold text-primary-foreground hover:bg-gold/90")}
        >
          Mis turnos
        </Button>
      </div>

      {tab === "new" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Scissors className="w-5 h-5 text-gold" />
                1. Servicio
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {SERVICES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  className={cn(
                    "text-left p-3 rounded-md border transition flex justify-between items-center",
                    serviceId === s.id
                      ? "border-gold bg-gold/10"
                      : "border-border hover:border-gold/50",
                  )}
                >
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ~{s.duration_min} min (estimado)
                    </div>
                  </div>
                  <span className="text-gold font-semibold">{formatGs(s.price)}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                2. Barbero
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {barbers.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay barberos disponibles.</p>
              )}
              {barbers.map((b) => {
                const busy = b.status === "busy";
                return (
                  <button
                    key={b.id}
                    disabled={busy}
                    onClick={() => setBarberId(b.id)}
                    className={cn(
                      "text-left p-3 rounded-md border transition flex justify-between items-center",
                      barberId === b.id
                        ? "border-gold bg-gold/10"
                        : "border-border hover:border-gold/50",
                      busy && "opacity-50 cursor-not-allowed hover:border-border",
                    )}
                  >
                    <span>{b.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        busy
                          ? "border-destructive text-destructive"
                          : "border-gold text-gold",
                      )}
                    >
                      {busy ? "Ocupado" : "Disponible"}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-gold" />
                3. Fecha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setSlot(null);
                }}
                disabled={(d) => isBefore(d, startOfDay(new Date()))}
                locale={es}
                className="pointer-events-auto"
              />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-gold" />
                4. Horario
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!service || !selectedBarber || !date ? (
                <p className="text-sm text-muted-foreground">
                  Elegí servicio, barbero y fecha.
                </p>
              ) : selectedBarber.status === "busy" ? (
                <p className="text-sm text-destructive">
                  El barbero está ocupado y no recibe nuevas reservas.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {allSlots.map((t) => {
                    const taken = isSlotTaken(selectedBarber.id, dateKey, t);
                    const selected = slot === t;
                    return (
                      <button
                        key={t}
                        disabled={taken}
                        onClick={() => setSlot(t)}
                        className={cn(
                          "py-2 rounded-md border text-sm transition",
                          selected
                            ? "border-gold bg-gold/20 text-gold"
                            : taken
                              ? "border-border opacity-40 line-through cursor-not-allowed"
                              : "border-border hover:border-gold/50",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}

              {slot && service && selectedBarber && date && (
                <div className="mt-6 pt-4 border-t border-border space-y-3">
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Servicio:</span> {service.name}{" "}
                      <span className="text-muted-foreground">(~{service.duration_min} min)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Barbero:</span>{" "}
                      {selectedBarber.name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cuándo:</span>{" "}
                      {format(date, "PPP", { locale: es })} a las {slot}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Precio:</span>{" "}
                      <span className="text-gold font-semibold">{formatGs(service.price)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={submit}
                    className="w-full bg-gold text-primary-foreground hover:bg-gold/90"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar reserva
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "mine" && (
        <div className="grid gap-3">
          {myBookings.length === 0 && (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                No tenés turnos todavía.
              </CardContent>
            </Card>
          )}
          {myBookings.map((b) => {
            const svc = SERVICES.find((s) => s.id === b.serviceId);
            const brb = barbers.find((x) => x.id === b.barberId);
            return (
              <Card key={b.id} className="bg-card border-border">
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {svc?.name} · {brb?.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {b.date} a las {b.time}
                    </div>
                    {svc && (
                      <span className="text-sm text-gold">{formatGs(svc.price)}</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      removeBooking(b.id);
                      toast.success("Turno cancelado");
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
};

export default ClientDashboard;
