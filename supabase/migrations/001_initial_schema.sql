-- PeopleFlow Initial Schema
-- Prefix: pf_

-- Departments
CREATE TABLE pf_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams (within departments)
CREATE TABLE pf_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES pf_departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Employees
CREATE TABLE pf_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT,
  department_id UUID REFERENCES pf_departments(id),
  team_id UUID REFERENCES pf_teams(id),
  manager_id UUID REFERENCES pf_employees(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'medical_leave')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criteria (configurable)
CREATE TABLE pf_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global settings
CREATE TABLE pf_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Evaluation cycles
CREATE TABLE pf_evaluation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quarterly', 'semi_annual', 'annual')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  anonymous BOOLEAN DEFAULT false,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Evaluations (one per evaluatee + evaluator + type + cycle)
CREATE TABLE pf_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES pf_evaluation_cycles(id) ON DELETE CASCADE,
  evaluatee_id UUID REFERENCES pf_employees(id),
  evaluator_id UUID REFERENCES pf_employees(id),
  type TEXT NOT NULL CHECK (type IN ('self', 'peer', 'manager')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  submitted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cycle_id, evaluatee_id, evaluator_id, type)
);

-- Evaluation answers (one row per criterion per evaluation)
CREATE TABLE pf_evaluation_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES pf_evaluations(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES pf_criteria(id),
  score INT CHECK (score BETWEEN 1 AND 5),
  UNIQUE (evaluation_id, criteria_id)
);

-- Seed default criteria
INSERT INTO pf_criteria (key, label, sort_order) VALUES
  ('responsibility',        'Responsabilidade',                                                        1),
  ('adaptability',          'Adaptação e Flexibilidade',                                               2),
  ('initiative',            'Iniciativa e Autonomia',                                                  3),
  ('teamwork',              'Trabalho em Equipa',                                                      4),
  ('attendance',            'Assiduidade',                                                             5),
  ('punctuality',           'Pontualidade',                                                            6),
  ('food_safety_rules',     'Cumprimento das Regras de Segurança Alimentar',                           7),
  ('food_safety_awareness', 'Consciência do Impacto da sua Função na Segurança do Produto',            8);

-- Seed default settings
INSERT INTO pf_settings (key, value) VALUES
  ('peer_evaluator_limit', '2'),
  ('default_cycle_type', 'annual');
