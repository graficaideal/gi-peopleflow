export const EVALUATION_TYPES = {
  SELF: 'self',
  PEER: 'peer',
  MANAGER: 'manager',
  GENERAL: 'general',
}

export const EVALUATION_TYPE_LABELS = {
  self: 'Autoavaliação',
  peer: 'Avaliação de Colega',
  manager: 'Avaliação de Chefia',
  general: 'Avaliação Geral',
}

export const CYCLE_TYPES = {
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  ANNUAL: 'annual',
}

export const CYCLE_TYPE_LABELS = {
  quarterly: 'Trimestral',
  semi_annual: 'Semestral',
  annual: 'Anual',
}

export const CYCLE_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
}

export const CYCLE_STATUS_LABELS = {
  draft: 'Rascunho',
  active: 'Ativo',
  closed: 'Fechado',
}

export const EVALUATION_STATUSES = {
  PENDING: 'pending',
  SENT: 'sent',
  OPENED: 'opened',
  SUBMITTED: 'submitted',
  CANCELLED: 'cancelled',
}

export const EVALUATION_STATUS_LABELS = {
  pending: 'Pendente',
  sent: 'Enviada',
  opened: 'Aberta',
  submitted: 'Submetida',
}

export const SCORE_LABELS = {
  1: 'Mau',
  2: 'Medíocre',
  3: 'Suficiente',
  4: 'Bom',
  5: 'Muito Bom',
}

export const EMPLOYEE_STATUS_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
  medical_leave: 'Baixa médica',
}

export const DEPARTMENT_AREAS = {
  ADMINISTRATIVA: 'administrativa',
  PRODUCAO: 'producao',
}

export const DEPARTMENT_AREA_LABELS = {
  administrativa: 'Administrativa',
  producao: 'Produção',
}

export const DEFAULT_CRITERIA = [
  { key: 'responsibility', label: 'Responsabilidade' },
  { key: 'adaptability', label: 'Adaptação e Flexibilidade' },
  { key: 'initiative', label: 'Iniciativa e Autonomia' },
  { key: 'teamwork', label: 'Trabalho em Equipa' },
  { key: 'attendance', label: 'Assiduidade' },
  { key: 'punctuality', label: 'Pontualidade' },
  { key: 'food_safety_rules', label: 'Cumprimento das Regras de Segurança Alimentar' },
  { key: 'food_safety_awareness', label: 'Consciência do Impacto da sua Função na Segurança do Produto' },
]
