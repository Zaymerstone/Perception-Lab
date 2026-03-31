CREATE POLICY "Allow anonymous reads for subject_code check"
ON public.experiment_results
FOR SELECT
TO anon
USING (true);