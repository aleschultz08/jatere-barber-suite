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
  fetchBookings,
  addBookingRemote,
  cancelBookingRemote,
  onStoreChange,
  generateSlots,
  isSlotTakenIn,
  type MockBarber,
  type MockBooking,
} from "@/lib/barberStore";

const ClientDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"new" | "mine">("new");

  const [barbers, setBarbers] = useState<MockBarber[]>([]);
  const [bookings, setBookings] = useState<MockBooking[]>([]);

  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    fetchBarbers().then(setBarbers);
    fetchBookings().then(setBookings);
  };

  useEffect(() => {
    refresh();
    return onStoreChange(refresh);
  }, []);

  const selectedServices = SERVICES.filter((s) => serviceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((s, x) => s + x.price, 0);
  const totalDuration = selectedServices.reduce((s, x) => s + x.duration_min, 0);
  const selectedBarber = barbers.find((b) => b.id === barberId);
  const dateKey = date ? format(date, "yyyy-MM-dd") : "";

  const allSlots = useMemo(() => generateSlots(dateKey || undefined), [dateKey]);

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.clientId === user?.id)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [bookings, user],
  );

  const toggleService = (id: string) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSlot(null);
  };

  const submit = async () => {
    if (!user || selectedServices.length === 0 || !selectedBarber || !date || !slot) return;
    if (selectedBarber.status === "busy") {
      toast.error("Este barbero está marcado como ocupado.");
      return;
    }
    if (isSlotTakenIn(bookings, selectedBarber.id, dateKey, slot, totalDuration)) {
      toast.error("Ese horario ya fue reservado.");
      return;
    }
    setSubmitting(true);
    try {
      const first = selectedServices[0];
      const namesJoined = selectedServices.map((s) => s.name).join(" + ");
      await addBookingRemote({
        barberId: selectedBarber.id,
        serviceId: first.id,
        serviceName: namesJoined,
        services: selectedServices.map((s) => ({
          id: s.id, name: s.name, price: s.price, duration_min: s.duration_min,
        })),
        date: dateKey,
        time: slot,
        durationMin: totalDuration,
        price: totalPrice,
        clientId: user.id,
        clientName: user.email ?? "",
        source: "online",
      });
      toast.success("¡Reserva confirmada!", {
        description: `${selectedServices.map((s) => s.name).join(" + ")} · ${dateKey} a las ${slot}`,
      });
      setSlot(null);
      setServiceIds([]);
      setDate(undefined);
      setTab("mine");
      refresh();
    } catch (e: any) {
      const msg = e?.message || "";
      if (/horario|reserv|overlap|disponible/i.test(msg)) {
        toast.error("Horario no disponible", {
          description: "Otra reserva ocupa ese tiempo. Elegí otro horario.",
        });
      } else {
        toast.error("No se pudo reservar", { description: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string, info?: string) => {
    if (!window.confirm("¿Cancelar este turno? Se liberará el horario.")) return;
    try {
      await cancelBookingRemote(id);
      toast.success("Turno cancelado", {
        description: info ? `Liberamos ${info}` : "El horario quedó libre.",
      });
      refresh();
    } catch (e: any) {
      toast.error("No se pudo cancelar", { description: e?.message });
    }
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
              {SERVICES.map((s) => {
                const checked = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    className={cn(
                      "text-left p-3 rounded-md border transition flex justify-between items-center gap-3",
                      checked ? "border-gold bg-gold/10" : "border-border hover:border-gold/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        checked ? "bg-gold border-gold" : "border-border",
                      )}>
                        {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                      </span>
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">~{s.duration_min} min</div>
                      </div>
                    </div>
                    <span className="text-gold font-semibold">{formatGs(s.price)}</span>
                  </button>
                );
              })}
              {selectedServices.length > 0 && (
                <div className="mt-2 pt-3 border-t border-border text-sm flex justify-between">
                  <span className="text-muted-foreground">
                    {selectedServices.length} servicio{selectedServices.length > 1 ? "s" : ""} · ~{totalDuration} min
                  </span>
                  <span className="text-gold font-semibold">{formatGs(totalPrice)}</span>
                </div>
              )}
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
              {selectedServices.length === 0 || !selectedBarber || !date ? (
                <p className="text-sm text-muted-foreground">
                  Elegí servicio(s), barbero y fecha.
                </p>
              ) : selectedBarber.status === "busy" ? (
                <p className="text-sm text-destructive">
                  El barbero está ocupado y no recibe nuevas reservas.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {allSlots.map((t) => {
                    const taken = isSlotTakenIn(bookings, selectedBarber.id, dateKey, t, totalDuration);
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

              {slot && selectedServices.length > 0 && selectedBarber && date && (
                <div className="mt-6 pt-4 border-t border-border space-y-3">
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Servicios:</span>{" "}
                      {selectedServices.map((s) => s.name).join(" + ")}{" "}
                      <span className="text-muted-foreground">(~{totalDuration} min)</span>
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
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="text-gold font-semibold">{formatGs(totalPrice)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full bg-gold text-primary-foreground hover:bg-gold/90"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {submitting ? "Reservando..." : "Confirmar reserva"}
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
            const brb = barbers.find((x) => x.id === b.barberId);
            const cancelled = b.status === "cancelled";
            return (
              <Card key={b.id} className="bg-card border-border">
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {b.serviceName ?? "Servicio"} · {brb?.name ?? "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {b.date} a las {b.time}
                    </div>
                    <span className="text-sm text-gold">{formatGs(b.price ?? 0)}</span>
                    {cancelled && (
                      <Badge variant="outline" className="border-destructive text-destructive ml-2">Cancelado</Badge>
                    )}
                  </div>
                  {!cancelled && b.status !== "completed" && (
                    <Button variant="outline" size="sm" onClick={() => cancel(b.id)}>
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
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
