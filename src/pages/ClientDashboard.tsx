import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, addMinutes, startOfDay, isBefore, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock, Scissors, User, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; duration_min: number; price: number };
type Barber = { id: string; name: string };
type Schedule = { weekday: number; start_time: string; end_time: string };
type Booking = {
  id: string; start_at: string; end_at: string; status: string; price: number;
  services: { name: string } | null; barbers: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada",
};

const ClientDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"new" | "mine">("new");

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dayBookings, setDayBookings] = useState<{ start_at: string; end_at: string }[]>([]);
  const [dayBlocks, setDayBlocks] = useState<{ start_at: string; end_at: string }[]>([]);
  const [slot, setSlot] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [mine, setMine] = useState<Booking[]>([]);

  const service = services.find(s => s.id === serviceId);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: b }] = await Promise.all([
        supabase.from("services").select("*").eq("active", true).order("name"),
        supabase.from("barbers").select("id,name").eq("active", true).order("name"),
      ]);
      setServices(s ?? []);
      setBarbers(b ?? []);
      if (b && b.length === 1) setBarberId(b[0].id);
    })();
  }, []);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select("id,start_at,end_at,status,price,services(name),barbers(name)")
      .eq("client_id", user.id)
      .order("start_at", { ascending: false });
    setMine((data as any) ?? []);
  };

  useEffect(() => { if (tab === "mine") loadMine(); }, [tab, user]);

  useEffect(() => {
    if (!barberId || !date) return;
    setSlot(null);
    (async () => {
      const dayStart = new Date(date); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(date); dayEnd.setHours(23,59,59,999);
      const [{ data: sch }, { data: bk }, { data: bl }] = await Promise.all([
        supabase.from("barber_schedules").select("weekday,start_time,end_time").eq("barber_id", barberId),
        supabase.from("bookings").select("start_at,end_at").eq("barber_id", barberId)
          .neq("status","cancelled")
          .gte("start_at", dayStart.toISOString()).lte("start_at", dayEnd.toISOString()),
        supabase.from("barber_blocks").select("start_at,end_at").eq("barber_id", barberId)
          .lte("start_at", dayEnd.toISOString()).gte("end_at", dayStart.toISOString()),
      ]);
      setSchedules(sch ?? []);
      setDayBookings(bk ?? []);
      setDayBlocks(bl ?? []);
    })();
  }, [barberId, date]);

  const slots = useMemo(() => {
    if (!service || !date || schedules.length === 0) return [];
    const wd = date.getDay();
    const todays = schedules.filter(s => s.weekday === wd);
    if (todays.length === 0) return [];
    const out: Date[] = [];
    const now = new Date();
    for (const s of todays) {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      const start = new Date(date); start.setHours(sh, sm, 0, 0);
      const end = new Date(date); end.setHours(eh, em, 0, 0);
      let cur = new Date(start);
      while (addMinutes(cur, service.duration_min) <= end) {
        const slotEnd = addMinutes(cur, service.duration_min);
        const overlap = [...dayBookings, ...dayBlocks].some(b => {
          const bs = parseISO(b.start_at).getTime(); const be = parseISO(b.end_at).getTime();
          return cur.getTime() < be && slotEnd.getTime() > bs;
        });
        if (!overlap && !isBefore(cur, now)) out.push(new Date(cur));
        cur = addMinutes(cur, 15);
      }
    }
    return out;
  }, [service, date, schedules, dayBookings, dayBlocks]);

  const submit = async () => {
    if (!user || !service || !barberId || !slot) return;
    setSubmitting(true);
    const end = addMinutes(slot, service.duration_min);
    const { error } = await supabase.from("bookings").insert({
      client_id: user.id, barber_id: barberId, service_id: service.id,
      start_at: slot.toISOString(), end_at: end.toISOString(),
      price: service.price, status: "confirmed",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("¡Turno reservado!");
    setSlot(null); setServiceId(""); setDate(undefined);
    setTab("mine");
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Turno cancelado");
    loadMine();
  };

  return (
    <DashboardShell title="Mi panel">
      <div className="flex gap-2 mb-6">
        <Button variant={tab==="new"?"default":"outline"} onClick={()=>setTab("new")}
          className={cn(tab==="new" && "bg-gold text-primary-foreground hover:bg-gold/90")}>
          Nueva reserva
        </Button>
        <Button variant={tab==="mine"?"default":"outline"} onClick={()=>setTab("mine")}
          className={cn(tab==="mine" && "bg-gold text-primary-foreground hover:bg-gold/90")}>
          Mis turnos
        </Button>
      </div>

      {tab === "new" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Scissors className="w-5 h-5 text-gold"/>1. Servicio</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {services.map(s => (
                <button key={s.id} onClick={()=>setServiceId(s.id)}
                  className={cn("text-left p-3 rounded-md border transition flex justify-between items-center",
                    serviceId===s.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/50")}>
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.duration_min} min</div>
                  </div>
                  <span className="text-gold font-semibold">${Number(s.price).toFixed(0)}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><User className="w-5 h-5 text-gold"/>2. Barbero</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {barbers.length === 0 && <p className="text-sm text-muted-foreground">No hay barberos disponibles.</p>}
              {barbers.map(b => (
                <button key={b.id} onClick={()=>setBarberId(b.id)}
                  className={cn("text-left p-3 rounded-md border transition",
                    barberId===b.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/50")}>
                  {b.name}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-gold"/>3. Fecha</CardTitle></CardHeader>
            <CardContent>
              <Calendar mode="single" selected={date} onSelect={setDate}
                disabled={(d)=> isBefore(d, startOfDay(new Date()))}
                locale={es} className="pointer-events-auto" />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-gold"/>4. Horario</CardTitle></CardHeader>
            <CardContent>
              {!service || !barberId || !date ? (
                <p className="text-sm text-muted-foreground">Elegí servicio, barbero y fecha.</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios disponibles para este día.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(t => (
                    <button key={t.toISOString()} onClick={()=>setSlot(t)}
                      className={cn("py-2 rounded-md border text-sm transition",
                        slot?.getTime()===t.getTime() ? "border-gold bg-gold/20 text-gold" : "border-border hover:border-gold/50")}>
                      {format(t, "HH:mm")}
                    </button>
                  ))}
                </div>
              )}
              {slot && service && (
                <div className="mt-6 pt-4 border-t border-border space-y-3">
                  <div className="text-sm space-y-1">
                    <div><span className="text-muted-foreground">Servicio:</span> {service.name}</div>
                    <div><span className="text-muted-foreground">Barbero:</span> {barbers.find(b=>b.id===barberId)?.name}</div>
                    <div><span className="text-muted-foreground">Cuándo:</span> {format(slot,"PPP 'a las' HH:mm",{locale:es})}</div>
                    <div><span className="text-muted-foreground">Precio:</span> <span className="text-gold font-semibold">${Number(service.price).toFixed(0)}</span></div>
                  </div>
                  <Button onClick={submit} disabled={submitting} className="w-full bg-gold text-primary-foreground hover:bg-gold/90">
                    <Check className="w-4 h-4 mr-2"/> Confirmar reserva
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "mine" && (
        <div className="grid gap-3">
          {mine.length === 0 && (
            <Card className="bg-card border-border"><CardContent className="py-8 text-center text-muted-foreground">No tenés turnos todavía.</CardContent></Card>
          )}
          {mine.map(b => {
            const dt = parseISO(b.start_at);
            const upcoming = dt > new Date() && b.status !== "cancelled";
            return (
              <Card key={b.id} className="bg-card border-border">
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-medium">{b.services?.name} · {b.barbers?.name}</div>
                    <div className="text-sm text-muted-foreground">{format(dt,"PPP 'a las' HH:mm",{locale:es})}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        b.status==="confirmed" && "border-gold text-gold",
                        b.status==="cancelled" && "border-destructive text-destructive",
                        b.status==="completed" && "border-muted-foreground",
                      )}>{STATUS_LABEL[b.status]}</Badge>
                      <span className="text-sm text-gold">${Number(b.price).toFixed(0)}</span>
                    </div>
                  </div>
                  {upcoming && (
                    <Button variant="outline" size="sm" onClick={()=>cancel(b.id)}>
                      <X className="w-4 h-4 mr-1"/> Cancelar
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
