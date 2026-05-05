// Store de la plataforma Jatere Barber.
// - Servicios: localStorage (mock).
// - Barberos y reservas: Supabase.

import { supabase } from "@/integrations/supabase/client";

export type BarberStatus = "available" | "busy";

export type MockBarber = {
  id: string;
  name: string;
  status: BarberStatus;
};

export type MockService = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
};

export type BookingStatus = "confirmed" | "in_progress" | "completed" | "cancelled";
export type BookingSource = "online" | "walkin";

export type BookingServiceItem = {
  id: string;
  name: string;
  price: number;
  duration_min: number;
};

export type MockBooking = {
  id: string;
  barberId: string;
  serviceId: string; // primer servicio (compatibilidad)
  serviceName?: string;
  services?: BookingServiceItem[]; // múltiples servicios
  date: string;
  time: string;
  clientName?: string;
  clientId?: string | null;
  status: BookingStatus;
  source: BookingSource;
  priceOverride?: number;
  price?: number;
};

const KEY_SERVICES = "jatere.services";
const EVT = "jatere.store.changed";

const DEFAULT_SERVICES: MockService[] = [
  { id: "svc-corte", name: "Corte", duration_min: 30, price: 45000 },
  { id: "svc-barba", name: "Barba", duration_min: 20, price: 20000 },
  { id: "svc-ceja", name: "Ceja", duration_min: 10, price: 10000 },
  { id: "svc-mascarilla", name: "Mascarilla", duration_min: 15, price: 10000 },
  { id: "svc-lavado", name: "Lavado", duration_min: 15, price: 20000 },
];

export function formatGs(value: number): string {
  return `Gs. ${value.toLocaleString("es-PY")}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(EVT));
}

// ===== Servicios (local) =====
export function getServices(): MockService[] {
  const list = read<MockService[]>(KEY_SERVICES, []);
  if (list.length === 0) {
    write(KEY_SERVICES, DEFAULT_SERVICES);
    return DEFAULT_SERVICES;
  }
  return list;
}
export const SERVICES: MockService[] = getServices();

export function saveService(s: MockService) {
  const list = getServices();
  const idx = list.findIndex((x) => x.id === s.id);
  const next = idx >= 0 ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s];
  write(KEY_SERVICES, next);
  SERVICES.length = 0;
  SERVICES.push(...next);
}
export function removeService(id: string) {
  const next = getServices().filter((s) => s.id !== id);
  write(KEY_SERVICES, next);
  SERVICES.length = 0;
  SERVICES.push(...next);
}

// ===== Barberos (Supabase) =====
if (typeof window !== "undefined") {
  try { localStorage.removeItem("jatere.barbers"); localStorage.removeItem("jatere.bookings"); } catch { /* noop */ }
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
  const slotEnd = slotStart + 30;
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
    const dur = Math.max(30, multi || svc?.duration_min || durationMin || 30);
    const bEnd = bStart + dur;
    return slotStart < bEnd && bStart < slotEnd;
  });
}

export function getBookingPrice(b: MockBooking): number {
  if (typeof b.price === "number" && b.price > 0) return b.price;
  if (typeof b.priceOverride === "number") return b.priceOverride;
  const svc = getServices().find((s) => s.id === b.serviceId);
  return svc?.price ?? 0;
}
