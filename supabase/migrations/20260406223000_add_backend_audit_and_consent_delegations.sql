ALTER TABLE public.audit_log
ADD COLUMN IF NOT EXISTS params_hash TEXT,
ADD COLUMN IF NOT EXISTS result_payload JSONB;

CREATE TABLE IF NOT EXISTS public.consent_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granted_by TEXT NOT NULL,
  granted_to TEXT NOT NULL,
  service TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_delegations_unique_active
ON public.consent_delegations (granted_by, granted_to, service);
