// Store de la plataforma Jatere Barber.
// Todo va contra Supabase. Servicios cacheados en memoria por sesión.

import { supabase } from "@/integrations/supabase/client";

export type BarberStatus = "available" | "busy";

export type MockBarber = {
  id: string;
  name: string;
  status: BarberStatus;
};

export type MockService = {
  id: string; // UUID real de Supabase
  name: string;
  duration_min: number;
  price: number;
};

export type BookingStatus = "confirmed" | "in_progress" | "completed" | "cancelled";
export type BookingSource = "online" | "walkin";

export type BookingServiceItem = {
  id: string; // UUID real
  name: string;
  price: number;
  duration_min: number;
};

export type MockBooking = {
  id: string;
  barberId: string;
  serviceId: string; // UUID del primer servicio (compatibilidad)
  serviceName?: string;
  services?: BookingServiceItem[];
  date: string;
  time: string;
  clientName?: string;
  clientId?: string | null;
  status: BookingStatus;
  source: BookingSource;
  priceOverride?: number;
  price?: number;
};

const EVT = "jatere.store.changed";

export function formatGs(value: number): string {
  return `Gs. ${value.toLocaleString("es-PY")}`;
}

// ===== Servicios (Supabase) =====
let _servicesCache: MockService[] = [];

export async function fetchServices(): Promise<MockService[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, duration_min, active")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  _servicesCache = data.map((s) => ({
    id: s.id,
    name: s.name,
    price: Number(s.price ?? 0),
    duration_min: s.duration_min,
  }));
  return _servicesCache;
}

// Acceso sincrónico a la última lista cargada
export function getServices(): MockService[] {
  return _servicesCache;
}

export async function saveServiceRemote(s: { id?: string; name: string; price: number; duration_min: number }) {
  if (s.id) {
    const { error } = await supabase
      .from("services")
      .update({ name: s.name, price: s.price, duration_min: s.duration_min })
      .eq("id", s.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("services")
      .insert({ name: s.name, price: s.price, duration_min: s.duration_min, active: true });
    if (error) throw error;
  }
  await fetchServices();
  window.dispatchEvent(new Event(EVT));
}

export async function removeServiceRemote(id: string) {
  // Soft delete: marcar inactivo para no romper bookings históricas.
  const { error } = await supabase.from("services").update({ active: false }).eq("id", id);
  if (error) throw error;
  await fetchServices();
  window.dispatchEvent(new Event(EVT));
}

// ===== Barberos (Supabase) =====
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("jatere.barbers");
    localStorage.removeItem("jatere.bookings");
    localStorage.removeItem("jatere.services");
  } catch { /* noop */ }
}

export async function fetchBarbers(): Promise<MockBarber[]> {
  const { data, error } = await supabase
    .from("barbers")
    .select("id, name, active")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.active ? "available" : "busy",
  }));
}

export async function setBarberStatusRemote(id: string, status: BarberStatus) {
  const { error } = await supabase
    .from("barbers")
    .update({ active: status === "available" })
    .eq("id", id);
  if (error) throw error;
  window.dispatchEvent(new Event(EVT));
}

export async function removeBarberRemote(id: string) {
  const { error } = await supabase.from("barbers").delete().eq("id", id);
  if (error) throw error;
  window.dispatchEvent(new Event(EVT));
}

// ===== Reservas (Supabase) =====
// La tabla `bookings` guarda start_at/end_at como timestamptz.
// Convertimos a y desde { date: 'YYYY-MM-DD', time: 'HH:mm' } en hora local.

function toLocalISO(date: string, time: string, addMin = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi + addMin, 0, 0);
  return dt.toISOString();
}
function fromIsoToLocalParts(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

function rowToBooking(row: any): MockBooking {
  const { date, time } = fromIsoToLocalParts(row.start_at);
  const source: BookingSource = row.booking_type === "walkin" ? "walkin" : "online";
  let services: BookingServiceItem[] | undefined;
  if (Array.isArray(row.services)) services = row.services as BookingServiceItem[];
  return {
    id: row.id,
    barberId: row.barber_id,
    serviceId: row.service_id,
    serviceName: row.service_name ?? undefined,
    services,
    date,
    time,
    clientName: row.notes ?? undefined,
    clientId: row.client_id,
    status: row.status as BookingStatus,
    source,
    price: Number(row.price ?? 0),
  };
}

export async function fetchBookings(): Promise<MockBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, barber_id, service_id, service_name, services, start_at, end_at, status, price, notes, client_id, booking_type")
    .order("start_at", { ascending: true });
  if (error || !data) return [];
  return data.map(rowToBooking);
}

export async function addBookingRemote(input: {
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  durationMin: number;
  serviceName: string;
  price: number;
  services?: BookingServiceItem[];
  clientId?: string | null;
  clientName?: string;
  source?: BookingSource;
}): Promise<MockBooking> {
  const start_at = toLocalISO(input.date, input.time, 0);
  const end_at = toLocalISO(input.date, input.time, Math.max(15, input.durationMin));
  const payload: any = {
    barber_id: input.barberId,
    service_id: input.serviceId,
    service_name: input.serviceName,
    services: input.services ?? null,
    start_at,
    end_at,
    price: input.price,
    status: "confirmed",
    booking_type: input.source === "walkin" ? "walkin" : "online",
    notes: input.clientName ?? null,
    client_id: input.clientId ?? null,
  };
  const { data, error } = await supabase.from("bookings").insert(payload).select().single();
  if (error) throw error;
  window.dispatchEvent(new Event(EVT));
  return rowToBooking(data);
}

export async function updateBookingStatusRemote(id: string, status: BookingStatus) {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
  window.dispatchEvent(new Event(EVT));
}

export async function cancelBookingRemote(id: string) {
  return updateBookingStatusRemote(id, "cancelled");
}

export function onStoreChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}

// ===== Horarios =====
function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function generateSlots(_date?: string): string[] {
  // Horario único: todos los días de 09:00 a 21:00
  const startMin = 9 * 60;
  const endMin = 21 * 60;
  const out: string[] = [];
  for (let t = startMin; t < endMin; t += 30) {
    out.push(fromMin(t));
  }
  return out;
}

// Verifica si un slot está ocupado dado un listado de reservas ya cargado
export function isSlotTakenIn(
  bookings: MockBooking[],
  barberId: string,
  date: string,
  time: string,
  durationMin = 30,
): boolean {
  const slotStart = toMin(time);
  // La duración del candidato también cuenta: un slot largo no puede pisar reservas posteriores.
  const slotEnd = slotStart + Math.max(30, durationMin || 30);
  const services = getServices();
  return bookings.some((b) => {
    if (b.barberId !== barberId) return false;
    if (b.date !== date) return false;
    if (b.status === "cancelled") return false;
    const bStart = toMin(b.time);
    const multi = b.services && b.services.length > 0
      ? b.services.reduce((s, x) => s + (x.duration_min || 0), 0)
      : 0;
    const svc = services.find((s) => s.id === b.serviceId);
    const dur = Math.max(30, multi || svc?.duration_min || 30);
    const bEnd = bStart + dur;
    return slotStart < bEnd && bStart < slotEnd;
  });
}

export function getBookingPrice(b: MockBooking): number {
  if (typeof b.price === "number" && b.price > 0) return b.price;
  if (typeof b.priceOverride === "number" && b.priceOverride > 0) return b.priceOverride;
  // Sumar precios desde services[] (multi-servicio)
  if (b.services && b.services.length > 0) {
    const cache = getServices();
    const total = b.services.reduce((sum, item) => {
      const p = Number(item.price);
      if (Number.isFinite(p) && p > 0) return sum + p;
      const fallback = cache.find((s) => s.id === item.id);
      return sum + (fallback?.price ?? 0);
    }, 0);
    if (total > 0) return total;
  }
  // Fallback al servicio principal
  const svc = getServices().find((s) => s.id === b.serviceId);
  return svc?.price ?? 0;
}
