
ALTER TABLE public.experiment_results RENAME COLUMN participant_email TO subject_code;
ALTER TABLE public.experiment_results ADD COLUMN block_number integer;
