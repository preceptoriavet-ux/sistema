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

## Implementado (2026-06) — Config Clínica + Documento no Prontuário
- Tela de Configuração da Clínica (aba em Usuários & Permissões, admin): editar nome, endereço, telefone, CNPJ e e-mail que aparecem nos PDFs (GET/PUT /api/config/clinica).
- Emissão de documento dentro do prontuário: botão "Emitir Documento" no atendimento gera o PDF (receita/atestado/etc.) já vinculado ao prontuário (prontuario_id) e abre para impressão.
- Verificado via API (update de config, documento com prontuario_id) e screenshots.

## Implementado (2026-06) — Relatórios + Logo nos PDFs
- Painel de Relatórios & Indicadores (/relatorios): filtro por período, KPIs (atendimentos, exames/críticos, vacinas, agendamentos/faltas), barras de atendimentos por espécie e exames por status, tabela de diagnósticos mais frequentes, vacinas por tipo e resumo operacional. Exportação em CSV (diagnósticos e vacinas). Endpoint GET /api/relatorios agrega prontuários, exames, vacinas, fila e agendamentos por data.
- Logotipo nos PDFs: upload da logo na aba Dados da Clínica (object storage); renderizada no topo de todos os documentos gerados (reportlab Image).
- Verificado via API (agregações, upload de logo, config) e visualmente (painel + PDF renderizado com logo).

## Implementado (2026-06) — Financeiro & Faturamento
- Módulo Financeiro (/financeiro) separado dos registros clínicos, com permissões próprias (financeiro:read/write; acesso: financeiro, gestor, admin — veterinário recebe 403): cadastro de serviços e preços; lançamentos de receitas e despesas com categoria, valor, desconto, status (pendente/pago/cancelado), forma de pagamento, data e vencimento; ação "marcar pago" (grava pago_em automático); vínculo opcional a tutor/paciente e seleção de serviço para preencher preço.
- Resumo financeiro por período: recebido, a receber, despesas pagas, a pagar e saldo. Endpoints: /api/servicos, /api/financeiro, /api/financeiro/resumo.
- Verificado via API (serviços, lançamentos, update de status, resumo, RBAC 403) e screenshot.

## Backlog priorizado
- P0 (Fase 2): Triagem veterinária, Prescrições e documentos clínicos (PDF), Exames e resultados (anexos PDF), Vacinação e retornos.
- P1 (Fase 3): Procedimentos, Estoque e farmácia, Financeiro/faturamento, Relatórios, Atendimento domiciliar, Comunicação com tutores.
- P2 (Fase 4): Internação e emergência, Gestão acadêmica avançada (clínica-escola), Indicadores gerenciais avançados, LGPD/backup avançado.

## Próximas tarefas
Triagem (encaminhamento automático ao prontuário + sinais de alerta), geração de documentos em PDF, módulo de exames com upload de laudos.

## 2026-10 — Fluxo Agenda ↔ Triagem ↔ Prontuário (DONE)
- Todo agendamento novo cria automaticamente um prontuário (rascunho) vinculado (agendamento_id), sem alterar prontuários anteriores.
- POST /api/agendamentos/{id}/iniciar: abre o prontuário do agendamento (ou cria novo se já usado) e marca agendamento "em_atendimento". Botão "Iniciar Atendimento" na Agenda.
- GET /api/prontuarios/{id}/triagem: triagem vinculada (triagem_id/agendamento_id) ou a mais recente do paciente no dia. Painel "Dados da Triagem" no prontuário (components/TriagemPanel.jsx).
- POST /api/prontuarios/{id}/concluir: salva/finaliza prontuário e marca agendamento "concluido". Botão "Concluir Atendimento".
- Triagem passa a vincular agendamento do dia (agendamento_id) e não duplica prontuário quando já existe o do agendamento.

## 2026-10 — Triagem: Iniciar / Concluir / Alterar / Excluir (DONE)
- POST /api/triagem → status "em_andamento" (fila → em_triagem), sem criar prontuário.
- PUT /api/triagem/{id} → salva ficha; se concluída, registra em `alteracoes` (at, por, campos, anterior) + auditoria.
- POST /api/triagem/{id}/concluir → status "concluida", cria/vincula prontuário rascunho, fila → aguardando_consulta.
- DELETE /api/triagem/{id} → exclui só a triagem (prontuário mantido); se em andamento, fila volta a aguardando_triagem.
- Painel de triagem do prontuário ignora triagens em andamento no fallback.
- UI: Triagem.jsx (Iniciar Triagem, Ficha, Salvar Ficha, Concluir Triagem, Continuar/Alterar, Excluir c/ confirmação) + components/TriagemFicha.jsx.
- Testado: iteration_1.json (backend 10/10 após correção, frontend 100%).

## Backlog
- P1: Estoque e Farmácia; Internação e Emergência; Atendimento Domiciliar; Procedimentos
- P2: Comunicação com tutores; Requisitos de Clínica-Escola

## 2026-10 — Chegada pela Agenda → Fila (DONE)
- POST /api/agendamentos/{id}/chegada (fila:write): coloca o paciente na fila "aguardando_recepcao" (tipo agendado, agendamento_id); se já ativo na fila, só vincula (sem duplicar). Agendamento recebe chegada_at e fila_id.
- Iniciar Atendimento → fila vinculada "em_consulta"; Concluir Atendimento → fila "concluido".
- UI Agenda: botão "Registrar Chegada" + badge "Chegou HH:MM". Testado via curl + screenshot.

## 2026-10 — Iniciar Atendimento → Fila "Em Consulta" sempre (DONE)
- iniciar_prontuario_core: busca entrada ativa da fila (por agendamento_id ou do paciente, qualquer origem) → "em_consulta" + vincula agendamento/prontuário; se não existir, cria entrada já "em_consulta". Prontuário guarda fila_id.
- POST /api/prontuarios/{id}/iniciar (botão "Iniciar Atendimento" no prontuário rascunho não iniciado); "Concluir Atendimento" aparece após iniciado e conclui fila (fila_id/agendamento_id) + agendamento.
- Prontuário criado pela triagem herda fila_id da triagem. Testado via curl (3 cenários) + screenshot.

## 2026-10 — Nº de cadastro numérico (tutores e pacientes) (DONE)
- Campo `codigo` (int) gerado por contador atômico em `counters` ($inc, find_one_and_update) + índice único parcial; sequências separadas (tutores / pacientes); não editável; números excluídos não são reutilizados.
- Startup (init_codigos): numera registros antigos por ordem de criação e sincroniza o contador.
- Busca por número em /api/tutores e /api/pacientes (match exato aparece primeiro). Exibido em listas, fichas, select de tutor e PDFs ("Nome (Nº X)").
- Testado: 15 criações simultâneas sem duplicidade; PDF verificado; screenshots.

## 2026-10 — Linha do Tempo do Paciente (DONE)
- Todos os registros (agendamentos, triagem, prontuários, exames, documentos, vacinas, fila) gravam `paciente_codigo`; backfill na inicialização via $lookup/$merge (link_paciente_codigos).
- GET /api/pacientes/{id}/historico (tipos, data_ini, data_fim) — eventos cronológicos (data_local = horário de Brasília), contadores, respeita RBAC por módulo. backend/historico.py.
- GET /api/pacientes/codigo/{n}; GET /api/pacientes/{id}/historico/pdf (build_historico_pdf em pdfgen.py).
- UI: /pacientes/:id/historico (PacienteHistorico.jsx + components/historico/*), botão "Linha do tempo" nos cards de Pacientes, filtros por tipo/período, "Ir para Nº", expandir itens, abrir prontuário/PDF/laudo, Exportar PDF.
- Testado: iteration_2.json (backend 22/22); correções de fuso/agrupamento, reset de filtros e layout mobile verificadas por screenshot.
- Pendente/conhecido: excluir paciente não remove registros clínicos vinculados (ficam órfãos).

## 2026-10 — Proteção de exclusão, Inativação e Gráfico de Peso (DONE)
- DELETE /api/pacientes/{id}: 409 se houver prontuários (exceto rascunhos vazios auto-criados pelo agendamento), exames, documentos, triagens ou vacinas — mensagem com contagens. Sem registros: exclui paciente + agendamentos/fila + rascunhos vazios.
- PUT /api/pacientes/{id}/ativo: inativar/reativar (ativo, inativado_at, inativado_por). Inativar cancela agendamentos pendentes e fila ativa. Inativos ocultos em /api/pacientes (incluir_inativos=true) e bloqueados para novos registros (creates, chegada, iniciar atendimento).
- Linha do tempo: série "pesos" (prontuários + triagens + cadastro via peso_atualizado_at) → PesoChart (recharts) com último peso e variação. Rascunhos vazios de agendamento não aparecem.
- UI: PacienteAcoes (Inativar/Reativar/Excluir com bloqueio), switch "Mostrar inativos", DateInput (shadcn Calendar pt-BR) no período do histórico e data de nascimento.
- Testes: iteration_3.json + correções; pytest 39/39; conftest.py limpa dados TEST_ ao final.

## 2026-10 — Modelos de Documento (DONE)
- Coleção `modelos_documento` {id, titulo, conteudo, created_by, created_at, updated_at}; CRUD /api/modelos-documento (GET prontuario:read; POST/PUT/DELETE prontuario:write); lista ordenada sem distinção de acento/caixa.
- POST /api/documentos aceita tipo="modelo" + modelo_id + titulo; variáveis {paciente}, {nº paciente}, {espécie}, {raça}, {tutor}, {data}, {veterinário} (com/sem acento) substituídas em corpo/medicamentos (backend/modelos.py) para todos os tipos; datas em horário de Brasília; PDF usa o título informado.
- pdfgen: todo texto do usuário é escapado (XML) antes do reportlab (corrige 500 com "<").
- UI: Documentos com abas Emitidos/Modelos (ModelosTab: Criar Modelo do Zero, editar, excluir, chips de variáveis); EmitirDocumentoCampos compartilhado entre Documentos (avulso) e Prontuário, com grupo "Modelos da clínica". Documentos avulsos e via prontuário aparecem na Linha do Tempo.
- Testes: iteration_4.json + correções; pytest 56/56.
