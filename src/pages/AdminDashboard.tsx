import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Plus, Users, Scissors, CalendarDays, DollarSign } from "lucide-react";
import {
  getBarbers, saveBarber, removeBarber,
  getServices, saveService, removeService,
  getBookings, getBookingPrice, onStoreChange,
  formatGs,
  type MockBarber, type MockService, type MockBooking,
} from "@/lib/barberStore";
import { format } from "date-fns";

type Tab = "barbers" | "services" | "bookings";

const STATUS_LABEL: Record<MockBooking["status"], string> = {
  confirmed: "Confirmado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const AdminDashboard = () => {
  const [tab, setTab] = useState<Tab>("barbers");
  const [barbers, setBarbers] = useState<MockBarber[]>([]);
  const [services, setServices] = useState<MockService[]>([]);
  const [bookings, setBookings] = useState<MockBooking[]>([]);

  const refresh = () => {
    setBarbers(getBarbers());
    setServices(getServices());
    setBookings(getBookings());
  };

  useEffect(() => { refresh(); return onStoreChange(refresh); }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayIncome = useMemo(
    () => bookings
      .filter((b) => b.date === today && b.status === "completed")
      .reduce((s, b) => s + getBookingPrice(b), 0),
    [bookings, today],
  );

  return (
    <DashboardShell title="Administración">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Users className="w-4 h-4" />} label="Barberos" value={String(barbers.length)} />
        <Stat icon={<Scissors className="w-4 h-4" />} label="Servicios" value={String(services.length)} />
        <Stat icon={<CalendarDays className="w-4 h-4" />} label="Citas hoy" value={String(bookings.filter(b => b.date === today && b.status !== "cancelled").length)} />
        <Stat icon={<DollarSign className="w-4 h-4" />} label="Ingresos hoy" value={formatGs(todayIncome)} />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <TabBtn active={tab === "barbers"} onClick={() => setTab("barbers")}>Barberos</TabBtn>
        <TabBtn active={tab === "services"} onClick={() => setTab("services")}>Servicios</TabBtn>
        <TabBtn active={tab === "bookings"} onClick={() => setTab("bookings")}>Citas</TabBtn>
      </div>

      {tab === "barbers" && <BarbersTab barbers={barbers} />}
      {tab === "services" && <ServicesTab services={services} />}
      {tab === "bookings" && <BookingsTab bookings={bookings} barbers={barbers} services={services} />}
    </DashboardShell>
  );
};

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <Button variant={active ? "default" : "outline"} onClick={onClick} size="sm"
    className={cn(active && "bg-gold text-primary-foreground hover:bg-gold/90")}>
    {children}
  </Button>
);

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="bg-card border-border"><CardContent className="p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
      <span className="text-gold">{icon}</span> {label}
    </div>
    <div className="text-lg font-display font-semibold truncate">{value}</div>
  </CardContent></Card>
);

// ===== Barberos =====
const BarbersTab = ({ barbers }: { barbers: MockBarber[] }) => {
  const [editing, setEditing] = useState<MockBarber | null>(null);
  const [open, setOpen] = useState(false);
  const startNew = () => { setEditing({ id: `brb-${Date.now()}`, name: "", status: "available" }); setOpen(true); };
  const startEdit = (b: MockBarber) => { setEditing(b); setOpen(true); };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display">Barberos</CardTitle>
        <Button size="sm" onClick={startNew} className="bg-gold text-primary-foreground hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-1" /> Nuevo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {barbers.map((b) => (
          <div key={b.id} className="flex items-center justify-between p-3 border border-border rounded-md">
            <div className="flex items-center gap-3">
              <span className="font-medium">{b.name}</span>
              <Badge variant="outline" className={b.status === "available" ? "border-gold text-gold" : "border-destructive text-destructive"}>
                {b.status === "available" ? "Disponible" : "Ocupado"}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => startEdit(b)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { removeBarber(b.id); toast.success("Barbero eliminado"); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {barbers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin barberos.</p>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-gold font-display">Barbero</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as MockBarber["status"] })}
                  className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm">
                  <option value="available">Disponible</option>
                  <option value="busy">Ocupado</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-gold text-primary-foreground hover:bg-gold/90" onClick={() => {
              if (!editing?.name.trim()) return toast.error("Falta el nombre");
              saveBarber(editing!);
              toast.success("Barbero guardado");
              setOpen(false);
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ===== Servicios =====
const ServicesTab = ({ services }: { services: MockService[] }) => {
  const [editing, setEditing] = useState<MockService | null>(null);
  const [open, setOpen] = useState(false);
  const startNew = () => { setEditing({ id: `svc-${Date.now()}`, name: "", price: 0, duration_min: 30 }); setOpen(true); };
  const startEdit = (s: MockService) => { setEditing(s); setOpen(true); };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display">Servicios</CardTitle>
        <Button size="sm" onClick={startNew} className="bg-gold text-primary-foreground hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-1" /> Nuevo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-md">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">~{s.duration_min} min · <span className="text-gold">{formatGs(s.price)}</span></div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => startEdit(s)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { removeService(s.id); toast.success("Servicio eliminado"); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-gold font-display">Servicio</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nombre</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Precio (Gs.)</Label>
                  <Input type="number" value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Duración (min)</Label>
                  <Input type="number" value={editing.duration_min}
                    onChange={(e) => setEditing({ ...editing, duration_min: Number(e.target.value) })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-gold text-primary-foreground hover:bg-gold/90" onClick={() => {
              if (!editing?.name.trim()) return toast.error("Falta el nombre");
              saveService(editing!); toast.success("Servicio guardado"); setOpen(false);
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ===== Citas =====
const BookingsTab = ({ bookings, barbers, services }: { bookings: MockBooking[]; barbers: MockBarber[]; services: MockService[] }) => {
  const sorted = [...bookings].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return (
    <Card className="bg-card border-border">
      <CardHeader><CardTitle className="font-display">Todas las citas</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin citas registradas.</p>}
        {sorted.map((b) => {
          const svc = services.find(s => s.id === b.serviceId);
          const brb = barbers.find(x => x.id === b.barberId);
          return (
            <div key={b.id} className="flex items-center justify-between p-3 border border-border rounded-md flex-wrap gap-2">
              <div className="space-y-0.5">
                <div className="font-medium">{b.date} · {b.time} — {svc?.name ?? "Servicio"}</div>
                <div className="text-xs text-muted-foreground">
                  {brb?.name ?? "—"} · {b.clientName || "Cliente"} · {b.source === "walkin" ? "Presencial" : "Online"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gold text-sm font-semibold">{formatGs(getBookingPrice(b))}</span>
                <Badge variant="outline" className="border-border text-muted-foreground">{STATUS_LABEL[b.status]}</Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AdminDashboard;
