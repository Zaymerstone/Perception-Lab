
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.experiment_results (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  participant_age text,
  participant_gender text,
  participant_vision text,
  participant_email text,
  experiment_type text,
  raw_data_string text,
  metadata jsonb
);

-- Allow anonymous inserts (no auth required for participants)
CREATE POLICY "Allow anonymous inserts" ON public.experiment_results
  FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated reads for researchers
CREATE POLICY "Allow authenticated reads" ON public.experiment_results
  FOR SELECT TO authenticated USING (true);
