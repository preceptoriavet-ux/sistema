import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

const PRIO = { emergencia: "bg-rose-100 text-rose-800 border-rose-300", urgente: "bg-amber-100 text-amber-800 border-amber-300" };
const ITEMS = [["temperatura", "Temp.", "°C"], ["fc", "FC", "bpm"], ["fr", "FR", "mpm"], ["peso", "Peso", "kg"], ["dor", "Dor", ""], ["hidratacao", "Hidratação", ""]];
const TEXTS = [["queixa_principal", "Queixa"], ["inicio_sinais", "Início dos sinais"], ["historico", "Histórico"], ["sinais_alerta", "Sinais de alerta"], ["info_tutor", "Info do tutor"], ["observacoes", "Observações"]];

export const TriagemPanel = ({ prontuarioId }) => {
  const [tri, setTri] = useState(undefined);
  useEffect(() => {
    setTri(undefined);
    api.get(`/prontuarios/${prontuarioId}/triagem`).then((r) => setTri(r.data.triagem)).catch(() => setTri(null));
  }, [prontuarioId]);

  if (tri === undefined) return null;
  if (!tri) return <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-2.5" data-testid="prontuario-sem-triagem">Nenhuma triagem vinculada a este atendimento.</p>;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 space-y-2" data-testid="prontuario-triagem-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-sky-900"><Activity className="h-3.5 w-3.5" />Dados da Triagem</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{new Date(tri.created_at).toLocaleString("pt-BR")} · {tri.responsavel}</span>
          <Badge variant="outline" className={PRIO[tri.prioridade] || ""} data-testid="prontuario-triagem-prioridade">{tri.prioridade}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ITEMS.map(([k, l, u]) => (
          <div key={k} className="rounded-md bg-card border px-2 py-1"><p className="text-[10px] text-muted-foreground">{l}</p><p className="text-sm font-medium" data-testid={`triagem-${k}`}>{tri[k] ? `${tri[k]} ${u}` : "—"}</p></div>
        ))}
      </div>
      {TEXTS.filter(([k]) => tri[k]).map(([k, l]) => (
        <p key={k} className="text-xs"><span className="font-medium">{l}:</span> <span className="text-muted-foreground whitespace-pre-wrap">{tri[k]}</span></p>
      ))}
    </div>
  );
};
