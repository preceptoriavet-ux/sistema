import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileDown, Search, X } from "lucide-react";
import { HistoricoHeader } from "@/components/historico/HistoricoHeader";
import { TimelineItem } from "@/components/historico/TimelineItem";
import { diaKey, parseData } from "@/components/historico/tipos";

const diaLabel = (k) => { const d = parseData(k); return d ? d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" }) : "Sem data"; };

export default function PacienteHistorico() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [periodo, setPeriodo] = useState({ data_ini: "", data_fim: "" });
  const [numero, setNumero] = useState("");
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => ({ tipos: tipos.join(","), ...periodo }), [tipos, periodo]);
  const load = useCallback(async () => {
    try { const { data: d } = await api.get(`/pacientes/${id}/historico`, { params }); setData(d); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  }, [id, params]);
  useEffect(() => { load(); }, [load]);

  const toggle = (k) => setTipos((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  const irPara = async (ev) => {
    ev.preventDefault();
    if (!/^\d+$/.test(numero)) return toast.error("Informe apenas números");
    try { const { data: p } = await api.get(`/pacientes/codigo/${numero}`); setNumero(""); navigate(`/pacientes/${p.id}/historico`); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const exportar = async () => {
    const w = window.open("", "_blank");
    setExporting(true);
    try {
      const { data: blob } = await api.get(`/pacientes/${id}/historico/pdf`, { params, responseType: "blob" });
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.location.assign(url);
    } catch (e) { w?.close(); toast.error("Falha ao gerar o PDF"); }
    finally { setExporting(false); }
  };

  const grupos = useMemo(() => {
    const g = [];
    (data?.eventos || []).forEach((e) => { const k = diaKey(e.data); const last = g[g.length - 1]; if (last?.k === k) last.itens.push(e); else g.push({ k, itens: [e] }); });
    return g;
  }, [data]);

  if (!data) return <p className="text-sm text-muted-foreground py-10 text-center">Carregando histórico…</p>;
  return (
    <div className="space-y-5" data-testid="paciente-historico-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")} data-testid="historico-voltar"><ArrowLeft className="h-4 w-4 mr-1" />Pacientes</Button>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={irPara} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ir para Nº do paciente" className="h-9 w-48 pl-8" data-testid="historico-ir-numero-input" />
          </form>
          <Button onClick={exportar} disabled={exporting} data-testid="historico-exportar-pdf"><FileDown className="h-4 w-4 mr-1.5" />{exporting ? "Gerando…" : "Exportar Histórico em PDF"}</Button>
        </div>
      </div>

      <HistoricoHeader paciente={data.paciente} tutor={data.tutor} contadores={data.contadores} selecionados={tipos} toggle={toggle} />

      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">De</Label><Input type="date" value={periodo.data_ini} onChange={(e) => setPeriodo((p) => ({ ...p, data_ini: e.target.value }))} className="h-9" data-testid="historico-data-ini" /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={periodo.data_fim} onChange={(e) => setPeriodo((p) => ({ ...p, data_fim: e.target.value }))} className="h-9" data-testid="historico-data-fim" /></div>
        {(tipos.length > 0 || periodo.data_ini || periodo.data_fim) && <Button variant="ghost" size="sm" onClick={() => { setTipos([]); setPeriodo({ data_ini: "", data_fim: "" }); }} data-testid="historico-limpar-filtros"><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
        <p className="ml-auto text-sm text-muted-foreground" data-testid="historico-total">{data.eventos.length} registro(s)</p>
      </div>

      {grupos.length === 0 && <p className="text-sm text-muted-foreground text-center py-10" data-testid="historico-vazio">Nenhum registro encontrado.</p>}
      <div className="space-y-6">
        {grupos.map((g) => (
          <section key={g.k} data-testid={`historico-dia-${g.k}`}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">{diaLabel(g.k)}</h2>
            <ol className="relative space-y-2 before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-border">
              {g.itens.map((e) => <TimelineItem key={e.id} e={e} />)}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
