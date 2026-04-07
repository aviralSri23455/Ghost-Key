-- Create audit_log table for persistent audit logging
CREATE TABLE public.audit_log (
  id TEXT NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  service TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'user_demo_001',
  token_hash TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'blocked', 'revoked', 'step_up_approved', 'step_up_denied', 'error')),
  step_up BOOLEAN NOT NULL DEFAULT false,
  details TEXT
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Public read/insert for demo (no auth required)
CREATE POLICY "Anyone can read audit log" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Index for querying by service and time
CREATE INDEX idx_audit_log_service ON public.audit_log (service);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;

-- Create services_state table to persist connection state
CREATE TABLE public.services_state (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_used TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read services" ON public.services_state FOR SELECT USING (true);
CREATE POLICY "Anyone can insert services" ON public.services_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update services" ON public.services_state FOR UPDATE USING (true);

-- Seed default services
INSERT INTO public.services_state (id, name, icon, scopes) VALUES
  ('google_calendar', 'Google Calendar', '📅', '["calendar.read","calendar.write","calendar.share"]'),
  ('gmail', 'Gmail', '✉️', '["mail.read","mail.send","mail.delete","mail.attachments"]'),
  ('slack', 'Slack', '💬', '["channels.read","chat.write","users.read","chat.write.public"]');