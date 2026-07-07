ALTER TABLE pf_evaluations DROP CONSTRAINT pf_evaluations_type_check;
ALTER TABLE pf_evaluations ADD CONSTRAINT pf_evaluations_type_check
CHECK (type IN ('self', 'peer', 'manager', 'general', 'subordinate'));
