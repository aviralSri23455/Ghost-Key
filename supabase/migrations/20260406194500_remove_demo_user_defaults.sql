ALTER TABLE public.audit_log
ALTER COLUMN user_id SET DEFAULT 'auth0|unknown';

UPDATE public.audit_log
SET user_id = 'auth0|unknown'
WHERE user_id = 'user_demo_001';
