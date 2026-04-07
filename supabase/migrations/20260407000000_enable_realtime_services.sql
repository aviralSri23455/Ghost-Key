-- Enable realtime for services_state so the dashboard updates instantly
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.services_state;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Allow delete on audit_log (for reset endpoint via service_role)
CREATE POLICY "Service role can delete audit log"
  ON public.audit_log FOR DELETE USING (true);
