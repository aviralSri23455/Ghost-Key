-- Fix #1: Add missing DELETE policy for audit_log (needed by /reset endpoint)
CREATE POLICY "Anyone can delete audit log" ON public.audit_log FOR DELETE USING (true);

-- Fix #2: Enable realtime for services_state (frontend subscribes but never receives updates)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.services_state;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;
