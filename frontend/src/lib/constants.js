export const ESPECIES = [
  { value: "canino", label: "Cão", icon: "🐕" },
  { value: "felino", label: "Gato", icon: "🐈" },
  { value: "ave", label: "Ave", icon: "🦜" },
  { value: "roedor", label: "Roedor", icon: "🐹" },
  { value: "lagomorfo", label: "Coelho", icon: "🐇" },
  { value: "reptil", label: "Réptil", icon: "🦎" },
  { value: "exotico", label: "Exótico", icon: "🐾" },
  { value: "outro", label: "Outro", icon: "🐾" },
];

export const especieLabel = (v) => ESPECIES.find((e) => e.value === v) || { label: v || "—", icon: "🐾" };

export const SEXOS = [
  { value: "macho", label: "Macho" },
  { value: "femea", label: "Fêmea" },
];

export const TIPOS_AGENDAMENTO = [
  { value: "consulta", label: "Consulta" },
  { value: "retorno", label: "Retorno" },
  { value: "exame", label: "Exame" },
  { value: "cirurgia", label: "Cirurgia" },
  { value: "vacina", label: "Vacinação" },
  { value: "encaixe", label: "Encaixe" },
];

export const FILA_STATUS = [
  { value: "aguardando_recepcao", label: "Aguardando Recepção", color: "bg-slate-100 text-slate-800 border-slate-300" },
  { value: "aguardando_triagem", label: "Aguardando Triagem", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "em_triagem", label: "Em Triagem", color: "bg-amber-200 text-amber-900 border-amber-400" },
  { value: "aguardando_consulta", label: "Aguardando Consulta", color: "bg-sky-100 text-sky-800 border-sky-300" },
  { value: "em_consulta", label: "Em Consulta", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "aguardando_procedimento", label: "Aguardando Procedimento", color: "bg-violet-100 text-violet-800 border-violet-300" },
  { value: "aguardando_finalizacao", label: "Aguardando Finalização", color: "bg-teal-100 text-teal-800 border-teal-300" },
  { value: "concluido", label: "Concluído", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "falta", label: "Falta", color: "bg-rose-100 text-rose-800 border-rose-300" },
  { value: "cancelado", label: "Cancelado", color: "bg-gray-100 text-gray-600 border-gray-300" },
];

export const filaStatus = (v) => FILA_STATUS.find((s) => s.value === v) || { label: v, color: "bg-slate-100 text-slate-700 border-slate-300" };

export const AG_STATUS = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "em_atendimento", label: "Em Atendimento" },
  { value: "concluido", label: "Concluído" },
  { value: "falta", label: "Falta" },
  { value: "cancelado", label: "Cancelado" },
];

export const TIPOS_DOCUMENTO = [
  { value: "receita", label: "Receita / Prescrição", medicamentos: true },
  { value: "atestado", label: "Atestado" },
  { value: "declaracao", label: "Declaração de Comparecimento" },
  { value: "orientacao", label: "Orientações ao Tutor" },
  { value: "encaminhamento", label: "Encaminhamento" },
  { value: "relatorio", label: "Relatório Clínico" },
  { value: "alta", label: "Recomendações de Alta" },
];

const VACINA_PROTOCOLOS = {
  canino: { v8: 21, v10: 21, v12: 21, polivalente: 21, multipla: 21, giardia: 21, gripe: 365, "tosse dos canis": 365, antirrabica: 365, raiva: 365, leishmaniose: 365 },
  felino: { v3: 21, v4: 21, v5: 21, triplice: 21, quadrupla: 21, quintupla: 21, leucemia: 21, felv: 21, antirrabica: 365, raiva: 365 },
};

export function suggestProximaDose(especie, nome, dataAplicacao) {
  if (!dataAplicacao) return "";
  const nl = (nome || "").trim().toLowerCase();
  const protos = VACINA_PROTOCOLOS[especie] || {};
  let dias = null;
  for (const k of Object.keys(protos)) if (nl.includes(k)) { dias = protos[k]; break; }
  if (dias == null) dias = /raiva|antirrab/.test(nl) ? 365 : 21;
  const d = new Date(dataAplicacao + "T00:00:00");
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
