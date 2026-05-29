# PeopleFlow

Aplicação interna de gestão de avaliações de desempenho da Gráfica Ideal.

## Stack

- React 18 + Vite
- Supabase (auth + base de dados)
- React Router v6
- Lucide React (ícones)
- Google Fonts: Outfit

## Funcionalidades

- Avaliação 360°: autoavaliação, avaliação por colega e avaliação pela chefia
- Ciclos configuráveis: trimestral, semestral, anual
- Atribuição automática de avaliadores por algoritmo
- Histórico de evolução por colaborador
- Dashboard com pendentes e indicadores
- Modo anónimo ou identificado por ciclo (configurado pelo RH)
- Dark/light mode

## Setup local

```bash
cp .env.example .env
# preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Base de dados

Correr a migration em `supabase/migrations/001_initial_schema.sql` no projeto Supabase.

## Deploy

Vercel (automático via GitHub push).
