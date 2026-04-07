ALTER TABLE public.audit_log
ALTER COLUMN user_id SET DEFAULT 'user:unresolved';

UPDATE public.audit_log
SET user_id = 'user:unresolved'
WHERE user_id = 'auth0|unknown';
