import { fileUrl } from "@/lib/api";
import { especieLabel } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Phone } from "lucide-react";
import { TIPOS_HIST } from "./tipos";

export const HistoricoHeader = ({ paciente, tutor, contadores, selecionados, toggle }) => {
  const esp = especieLabel(paciente.especie);
  const alertas = [paciente.alergias && `Alergias: ${paciente.alergias}`, paciente.alertas && `Alertas: ${paciente.alertas}`].filter(Boolean);
  return (
    <Card className="p-5 space-y-4" data-testid="historico-header">
      <div className="flex flex-wrap items-start gap-4">
        {paciente.foto ? <img src={fileUrl(paciente.foto)} alt={paciente.nome} className="h-20 w-20 rounded-xl object-cover" />
          : <div className="grid place-items-center h-20 w-20 rounded-xl bg-secondary text-4xl">{esp.icon}</div>}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight" data-testid="historico-paciente-nome">{paciente.nome}</h1>
            <Badge variant="outline" className="font-mono text-primary border-primary/40" data-testid="historico-paciente-codigo">Nº {paciente.codigo ?? "—"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{esp.label} · {paciente.raca || "SRD"}{paciente.sexo && ` · ${paciente.sexo}`}{paciente.peso && ` · ${paciente.peso} kg`}{paciente.idade_estimada && ` · ${paciente.idade_estimada}`}</p>
          <p className="text-sm" data-testid="historico-tutor">Tutor: <span className="font-medium">{tutor.nome || "—"}</span> <span className="font-mono text-xs text-muted-foreground">(Nº {tutor.codigo ?? "—"})</span>
            {tutor.telefone && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{tutor.telefone}</span>}</p>
        </div>
        {alertas.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 w-full sm:w-auto sm:max-w-sm space-y-0.5" data-testid="historico-alertas">
            <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Atenção</p>
            {alertas.map((a) => <p key={a}>{a}</p>)}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPOS_HIST).map(([k, cfg]) => {
          const on = selecionados.includes(k); const Icon = cfg.icon;
          return (
            <button key={k} onClick={() => toggle(k)} data-testid={`historico-filtro-${k}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-[background-color,opacity] ${on ? cfg.chip : "bg-card text-muted-foreground"} ${selecionados.length && !on ? "opacity-60" : ""}`}>
              <Icon className="h-3.5 w-3.5" />{cfg.label}<span className="font-mono" data-testid={`historico-contador-${k}`}>{contadores[k] || 0}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};
