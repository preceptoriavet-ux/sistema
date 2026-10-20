import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fileUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ExternalLink, FileDown, AlertTriangle } from "lucide-react";
import { TIPOS_HIST, parseData } from "./tipos";

export const TimelineItem = ({ e }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const cfg = TIPOS_HIST[e.tipo] || TIPOS_HIST.documento;
  const Icon = cfg.icon;
  const d = parseData(e.data);
  const hora = e.data?.length > 10 && d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <li className="relative pl-10" data-testid={`historico-item-${e.id}`}>
      <span className={`absolute left-0 top-3 grid h-8 w-8 place-items-center rounded-full text-white ring-4 ring-background ${cfg.dot}`}><Icon className="h-4 w-4" /></span>
      <div className="rounded-xl border bg-card transition-[box-shadow] hover:shadow-sm">
        <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen((o) => !o)} data-testid={`historico-toggle-${e.id}`}>
          <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{hora || "—"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{e.titulo}</p>
            <p className="truncate text-xs text-muted-foreground">{cfg.label}{e.campos?.[0] && ` · ${e.campos[0][1]}`}</p>
          </div>
          {e.critico && <Badge className="bg-rose-100 text-rose-800 border-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Crítico</Badge>}
          <Badge variant="outline" className={cfg.chip}>{e.status_label}</Badge>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="border-t px-4 py-3 space-y-2" data-testid={`historico-detalhe-${e.id}`}>
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {e.campos.map(([k, v]) => (
                <div key={k} className={v.length > 60 ? "sm:col-span-2" : ""}><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="text-sm whitespace-pre-wrap">{v}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {e.prontuario_id && <Button size="sm" variant="outline" onClick={() => navigate(`/prontuarios?abrir=${e.prontuario_id}`)} data-testid={`historico-abrir-prontuario-${e.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir prontuário</Button>}
              {e.pdf_path && <Button size="sm" variant="outline" asChild><a href={fileUrl(e.pdf_path)} target="_blank" rel="noreferrer" data-testid={`historico-pdf-${e.id}`}><FileDown className="h-3.5 w-3.5 mr-1" />Ver PDF</a></Button>}
              {e.laudo_path && <Button size="sm" variant="outline" asChild><a href={fileUrl(e.laudo_path)} target="_blank" rel="noreferrer" data-testid={`historico-laudo-${e.id}`}><FileDown className="h-3.5 w-3.5 mr-1" />Ver laudo</a></Button>}
            </div>
          </div>
        )}
      </div>
    </li>
  );
};
