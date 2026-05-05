// Local mock store (sin DB) para disponibilidad y reservas.
// Compartido entre paneles cliente, barbero y admin vía localStorage + eventos.

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

export type MockBooking = {
  id: string;
  barberId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  clientName?: string;
  status: BookingStatus;
  source: BookingSource;
  priceOverride?: number;
};

const KEY_BARBERS = "jatere.barbers";
const KEY_SERVICES = "jatere.services";
const KEY_BOOKINGS = "jatere.bookings";
const EVT = "jatere.store.changed";

const DEFAULT_SERVICES: MockService[] = [
  { id: "svc-corte", name: "Corte", duration_min: 30, price: 45000 },
  { id: "svc-barba", name: "Barba", duration_min: 20, price: 20000 },
  { id: "svc-ceja", name: "Ceja", duration_min: 10, price: 10000 },
  { id: "svc-mascarilla", name: "Mascarilla", duration_min: 15, price: 10000 },
  { id: "svc-lavado", name: "Lavado", duration_min: 15, price: 20000 },
];

const DEFAULT_BARBERS: MockBarber[] = [
  { id: "brb-jatere", name: "Jatere", status: "available" },
  { id: "brb-luis", name: "Luis", status: "available" },
];

// Formatea precios en guaraníes (Gs. 45.000)
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

// ===== Servicios =====
export function getServices(): MockService[] {
  const list = read<MockService[]>(KEY_SERVICES, []);
  if (list.length === 0) {
    write(KEY_SERVICES, DEFAULT_SERVICES);
    return DEFAULT_SERVICES;
  }
  return list;
}
// Compat: muchos componentes importan SERVICES como constante.
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

// ===== Barberos =====
export function getBarbers(): MockBarber[] {
  const list = read<MockBarber[]>(KEY_BARBERS, []);
  if (list.length === 0) {
    write(KEY_BARBERS, DEFAULT_BARBERS);
    return DEFAULT_BARBERS;
  }
  return list;
}

export function setBarberStatus(id: string, status: BarberStatus) {
  const list = getBarbers().map((b) => (b.id === id ? { ...b, status } : b));
  write(KEY_BARBERS, list);
}

export function saveBarber(b: MockBarber) {
  const list = getBarbers();
  const idx = list.findIndex((x) => x.id === b.id);
  const next = idx >= 0 ? list.map((x) => (x.id === b.id ? b : x)) : [...list, b];
  write(KEY_BARBERS, next);
}
export function removeBarber(id: string) {
  write(KEY_BARBERS, getBarbers().filter((b) => b.id !== id));
}

// ===== Reservas =====
export function getBookings(): MockBooking[] {
  return read<MockBooking[]>(KEY_BOOKINGS, []);
}

export function addBooking(
  b: Omit<MockBooking, "id" | "status" | "source"> & {
    status?: BookingStatus;
    source?: BookingSource;
  },
): MockBooking {
  const all = getBookings();
  const created: MockBooking = {
    status: "confirmed",
    source: "online",
    ...b,
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  } as MockBooking;
  write(KEY_BOOKINGS, [...all, created]);
  return created;
}

export function updateBookingStatus(id: string, status: BookingStatus) {
  const all = getBookings().map((b) => (b.id === id ? { ...b, status } : b));
  write(KEY_BOOKINGS, all);
}

export function removeBooking(id: string) {
  write(KEY_BOOKINGS, getBookings().filter((b) => b.id !== id));
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

// Horarios:
// - Lun-Sáb: 09:30–21:00
// - Domingo: 12:00–18:30
// - Bloqueo almuerzo: 12:00–13:00 (no se muestran slots)
// Intervalo: 30 min
function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// date opcional (YYYY-MM-DD). Si no se pasa, devuelve unión genérica (lun-sáb).
export function generateSlots(date?: string): string[] {
  let startMin = 9 * 60 + 30;
  let endMin = 21 * 60;
  if (date) {
    // Parse local sin desfase de zona horaria
    const [y, m, d] = date.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0 = dom
    if (dow === 0) {
      startMin = 12 * 60;
      endMin = 18 * 60 + 30;
    }
  }
  const lunchStart = 12 * 60;
  const lunchEnd = 13 * 60;
  const out: string[] = [];
  for (let t = startMin; t < endMin; t += 30) {
    if (t >= lunchStart && t < lunchEnd) continue;
    out.push(fromMin(t));
  }
  return out;
}

// Devuelve true si ese slot exacto ya está tomado
// O si se solapa con la duración de otra cita activa del barbero ese día.
export function isSlotTaken(barberId: string, date: string, time: string): boolean {
  const slotStart = toMin(time);
  const slotEnd = slotStart + 30;
  const services = getServices();
  return getBookings().some((b) => {
    if (b.barberId !== barberId) return false;
    if (b.date !== date) return false;
    if (b.status === "cancelled") return false;
    const bStart = toMin(b.time);
    const svc = services.find((s) => s.id === b.serviceId);
    const dur = Math.max(30, svc?.duration_min ?? 30);
    const bEnd = bStart + dur;
    return slotStart < bEnd && bStart < slotEnd;
  });
}

export function getBookingPrice(b: MockBooking): number {
  if (typeof b.priceOverride === "number") return b.priceOverride;
  const svc = getServices().find((s) => s.id === b.serviceId);
  return svc?.price ?? 0;
}
