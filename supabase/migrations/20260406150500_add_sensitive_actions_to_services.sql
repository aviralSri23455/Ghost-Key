ALTER TABLE public.services_state
ADD COLUMN IF NOT EXISTS sensitive_actions JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.services_state
SET sensitive_actions = CASE id
  WHEN 'gmail' THEN '["send_mass_email","delete_thread","send_with_attachment_over_5mb"]'::jsonb
  WHEN 'google_calendar' THEN '["delete_all_events","share_calendar_externally"]'::jsonb
  WHEN 'slack' THEN '["post_to_public_channel","send_dm_to_all_members"]'::jsonb
  ELSE '[]'::jsonb
END
WHERE sensitive_actions = '[]'::jsonb;
