# PRD — VetCare Pro (Sistema de Gestão para Clínica Veterinária)

## Problema original
Sistema completo de gestão para clínica veterinária (pt-BR), modular e interligado: cadastros, agendamentos, recepção, triagem, prontuários, procedimentos, exames, internação, estoque, financeiro e relatórios. 23 módulos no escopo total.

## Decisões / Arquitetura
- Stack: FastAPI + MongoDB + React 19 (Vite) + Tailwind v4 + shadcn/ui.
- Auth: JWT e-mail/senha (cookies httpOnly + Bearer token em localStorage), bcrypt, seed de admin.
- RBAC: 8 papéis (admin, gestor, recepcionista, veterinario, estagiario, auxiliar, estoque, financeiro) com mapa de permissões no backend (`require()`).
- Clínica única (sem multi-tenant). Auditoria de alterações relevantes em `audit_log`.
- Upload (foto do animal / anexos) em Emergent Object Storage.
- Design: tema Emerald clínico, fontes Manrope/Work Sans/JetBrains Mono.

## Personas
Administrador, Gestor, Recepcionista, Médico-Veterinário, Estagiário (clínica-escola), Auxiliar, Estoque, Financeiro.

## Implementado (2026-06) — Fase 1
- Login + controle de usuários e permissões por função (CRUD de usuários, aba de permissões, auditoria).
- Cadastro de Tutores (CRUD, busca, bloqueio de CPF duplicado e exclusão com pets vinculados).
- Cadastro de Pacientes (CRUD, vínculo ao tutor, foto via object storage, alertas de alergia).
- Agendamento (visão diária, criação/edição, detecção de conflito de horário por profissional → 409).
- Recepção / Fila (kanban com status configurados, check-in, prioridade emergência, avançar etapa).
- Prontuário clínico básico (anamnese/exame físico/conduta em abas, rascunho→finalizado, correção rastreável, fluxo estagiário→aguardando_revisão→validado pelo veterinário supervisor).
- Dashboard com KPIs, fila em tempo real e agenda do dia.

Validado por testing agent (backend 100% após fix de conflito de agenda; frontend smoke flows OK).

## Implementado (2026-06) — Fase 2 (parcial)
- Triagem Veterinária: sinais vitais, queixa, prioridade (normal/urgente/emergência), sinais de alerta; encaminhamento automático ao prontuário (cria registro com origem=triagem) e atualização da fila para "aguardando_consulta". Permissões: triagem:read/write.
- Vacinação & Medicina Preventiva: registro de vacinas/vermífugos/ectoparasitas (lote, validade, dose, via, próxima dose, reações), carteira/histórico, aba de pendentes (destaca vencidas) e contador de pendências no dashboard. Permissões: vacina:read/write.
- Verificado via API (triagem→prontuário, pendentes, dashboard) e screenshots das telas.

## Implementado (2026-06) — Exames + Alertas
- Exames Laboratoriais e de Imagem: solicitação, categoria (laboratorial/imagem), laboratório, data de coleta, status (solicitado/coletado/em_processamento/concluído/cancelado), resultado, sinalização de resultado crítico, anexo de laudo em PDF/imagem (object storage) e observações/pendências. Permissões: exame:read/write.
- Alerta de Emergência no painel: destaque das triagens com prioridade de emergência do dia + contador de exames críticos.
- Verificado via API (CRUD de exame, update de status, RBAC financeiro→403, dashboard) e screenshots.

## Implementado (2026-06) — Documentos PDF + Integrações
- Documentos Clínicos em PDF (reportlab): receita/prescrição, atestado, declaração, orientações, encaminhamento, relatório e alta. Gerado com cabeçalho da clínica, dados do paciente/tutor, corpo e assinatura do profissional (nome + CRMV); armazenado em object storage e aberto/impresso via link. Config da clínica em db.config (seed padrão, editável por admin via /api/config/clinica).
- Resultado de exames dentro do prontuário: a tela de prontuário lista os exames do paciente com status, resultado e link do laudo; filtro /exames?prontuario_id adicionado.
- Protocolos de vacina: sugestão automática da próxima dose por espécie + tipo (ex.: V10 canino → +21 dias, antirrábica → +365 dias), no backend (fallback ao salvar) e no frontend (hint "Sugerido pelo protocolo").
- PDF verificado visualmente (render PNG) e demais fluxos via API + screenshots.

## Backlog priorizado
- P0 (Fase 2): Triagem veterinária, Prescrições e documentos clínicos (PDF), Exames e resultados (anexos PDF), Vacinação e retornos.
- P1 (Fase 3): Procedimentos, Estoque e farmácia, Financeiro/faturamento, Relatórios, Atendimento domiciliar, Comunicação com tutores.
- P2 (Fase 4): Internação e emergência, Gestão acadêmica avançada (clínica-escola), Indicadores gerenciais avançados, LGPD/backup avançado.

## Próximas tarefas
Triagem (encaminhamento automático ao prontuário + sinais de alerta), geração de documentos em PDF, módulo de exames com upload de laudos.
