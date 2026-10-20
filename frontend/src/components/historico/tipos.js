import { CalendarDays, Activity, Stethoscope, ClipboardList, FlaskConical, FileText, Syringe } from "lucide-react";

export const TIPOS_HIST = {
  agendamento: { label: "Agenda", icon: CalendarDays, dot: "bg-slate-500", chip: "bg-slate-100 text-slate-700 border-slate-300" },
  triagem: { label: "Triagem", icon: Activity, dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800 border-amber-300" },
  prontuario: { label: "Prontuário", icon: Stethoscope, dot: "bg-emerald-600", chip: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  solicitacao: { label: "Solicitação de exames", icon: ClipboardList, dot: "bg-cyan-600", chip: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  exame: { label: "Exame", icon: FlaskConical, dot: "bg-sky-600", chip: "bg-sky-100 text-sky-800 border-sky-300" },
  documento: { label: "Documento", icon: FileText, dot: "bg-stone-600", chip: "bg-stone-100 text-stone-700 border-stone-300" },
  vacina: { label: "Vacina", icon: Syringe, dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800 border-rose-300" },
};

export const parseData = (s) => {
  if (!s) return null;
  if (s.length === 10) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  return new Date(s);
};

export const diaKey = (e) => (e.data_local || "").slice(0, 10) || "—";
