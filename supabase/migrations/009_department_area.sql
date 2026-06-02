-- Add area classification to departments
ALTER TABLE pf_departments
  ADD COLUMN IF NOT EXISTS area TEXT CHECK (area IN ('administrativa', 'producao'));
