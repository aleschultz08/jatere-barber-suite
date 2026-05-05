DROP TRIGGER IF EXISTS bookings_check_overlap ON public.bookings;
CREATE TRIGGER bookings_check_overlap
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.check_booking_overlap();