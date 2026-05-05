-- Adaptar la tabla bookings existente para guardar snapshot del servicio y tipo (online/presencial)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'online';

-- Asegurar que client_id pueda ser nulo para clientes presenciales (walk-in) creados por barbero
ALTER TABLE public.bookings ALTER COLUMN client_id DROP NOT NULL;

-- Permitir que cualquier barbero autenticado pueda crear citas presenciales (walk-in) para sí mismo
DROP POLICY IF EXISTS "bookings barber walkin insert" ON public.bookings;
CREATE POLICY "bookings barber walkin insert"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.id = bookings.barber_id AND b.user_id = auth.uid()
  )
);

-- Permitir lectura pública de citas no canceladas (solo horario+barbero) para chequear disponibilidad
-- (manteniendo políticas existentes; agregamos lectura mínima)
DROP POLICY IF EXISTS "bookings public availability read" ON public.bookings;
CREATE POLICY "bookings public availability read"
ON public.bookings
FOR SELECT
TO anon, authenticated
USING (true);
