-- Relationships between departments (administrative area, no teams) and
-- between teams (production area). Both are bidirectional: a single row
-- represents A<->B, enforced via canonical ordering (a_id < b_id) so the
-- app never has to worry about which order the user picked the pair in.
-- No RLS: matches pf_departments/pf_teams, neither of which has RLS enabled.

CREATE TABLE pf_department_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_a_id UUID NOT NULL REFERENCES pf_departments(id) ON DELETE CASCADE,
  department_b_id UUID NOT NULL REFERENCES pf_departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (department_a_id < department_b_id),
  UNIQUE (department_a_id, department_b_id)
);

CREATE TABLE pf_team_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id UUID NOT NULL REFERENCES pf_teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES pf_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (team_a_id < team_b_id),
  UNIQUE (team_a_id, team_b_id)
);
