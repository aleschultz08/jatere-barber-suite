
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'cancelled' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.barber_id = NEW.barber_id
      AND b.id <> NEW.id
      AND b.status <> 'cancelled'
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'El horario ya está reservado para este barbero';
  END IF;
  IF NEW.status <> 'cancelled' AND EXISTS (
    SELECT 1 FROM public.barber_blocks bl
    WHERE bl.barber_id = NEW.barber_id
      AND tstzrange(bl.start_at, bl.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'El barbero no está disponible en ese horario';
  END IF;
  RETURN NEW;
END; $$;
