-- Permitir que un barbero actualice su propia fila (para alternar disponible/ocupado vía 'active')
CREATE POLICY "barbers self update"
ON public.barbers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());