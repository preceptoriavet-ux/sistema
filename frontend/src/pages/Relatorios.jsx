import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stethoscope, FlaskConical, Syringe, CalendarDays, Download, AlertTriangle } from "lucide-react";

const iso = (d) => d.toISOString().slice(0, 10);
const brDate = (s) => (s ? s.split("-").reverse().join("/") : "");

function exportCSV(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Kpi({ icon: Icon, label, value, tint, testid }) {
  return (
    <Card className="p-5 flex items-center gap-4" data-testid={testid}>
      <div className={`grid place-items-center h-12 w-12 rounded-xl ${tint}`}><Icon className="h-6 w-6" /></div>
      <div><p className="text-2xl font-heading font-extrabold leading-none font-mono">{value ?? "—"}</p><p className="text-xs text-muted-foreground mt-1">{label}</p></div>
    </Card>
  );
}

function BarList({ title, data, labelKey, maxItems = 8 }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <Card className="p-5">
      <h2 className="font-heading text-lg font-bold mb-4">{title}</h2>
      {data.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p> : (
        <div className="space-y-2.5">
          {data.slice(0, maxItems).map((d, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-0.5"><span className="truncate">{d[labelKey]}</span><span className="font-mono text-muted-foreground">{d.total}</span></div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(d.total / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Relatorios() {
  const [ini, setIni] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [fim, setFim] = useState(iso(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/relatorios", { params: { data_ini: ini, data_fim: fim } });
      setData(data);
    } finally { setLoading(false); }
  }, [ini, fim]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const r = data?.resumo || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Relatórios & Indicadores</h1><p className="text-sm text-muted-foreground">Período: {brDate(ini)} a {brDate(fim)}</p></div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-40" data-testid="rel-data-ini" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" data-testid="rel-data-fim" /></div>
          <Button onClick={load} disabled={loading} data-testid="rel-atualizar-button">{loading ? "…" : "Atualizar"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Stethoscope} label="Atendimentos" value={r.atendimentos} tint="bg-emerald-100 text-emerald-700" testid="rel-kpi-atendimentos" />
        <Kpi icon={FlaskConical} label={`Exames (${r.exames_criticos || 0} críticos)`} value={r.exames} tint="bg-sky-100 text-sky-700" testid="rel-kpi-exames" />
        <Kpi icon={Syringe} label="Vacinas aplicadas" value={r.vacinas} tint="bg-violet-100 text-violet-700" testid="rel-kpi-vacinas" />
        <Kpi icon={CalendarDays} label={`Agendamentos (${r.faltas || 0} faltas)`} value={r.agendamentos} tint="bg-amber-100 text-amber-700" testid="rel-kpi-agendamentos" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <BarList title="Atendimentos por espécie" data={(data?.por_especie || []).map((e) => ({ ...e, label: especieLabel(e.especie).label }))} labelKey="label" />
        <BarList title="Exames por status" data={data?.exames_por_status || []} labelKey="status" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-heading text-lg font-bold">Diagnósticos mais frequentes</h2>
          <Button variant="outline" size="sm" onClick={() => exportCSV(`diagnosticos_${ini}_${fim}.csv`, ["Diagnóstico", "Total"], (data?.diagnosticos || []).map((d) => [d.diagnostico, d.total]))} disabled={!data?.diagnosticos?.length} data-testid="export-diagnosticos-button">
            <Download className="h-4 w-4 mr-1.5" />Exportar CSV
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Diagnóstico</TableHead><TableHead className="text-right">Ocorrências</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data?.diagnosticos || []).map((d, i) => (
              <TableRow key={i} data-testid={`diag-row-${i}`}><TableCell>{d.diagnostico}</TableCell><TableCell className="text-right font-mono">{d.total}</TableCell></TableRow>
            ))}
            {!data?.diagnosticos?.length && <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Nenhum diagnóstico registrado no período.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold">Vacinas por tipo</h2>
            <Button variant="outline" size="sm" onClick={() => exportCSV(`vacinas_${ini}_${fim}.csv`, ["Tipo", "Total"], (data?.vacinas_por_tipo || []).map((d) => [d.tipo, d.total]))} disabled={!data?.vacinas_por_tipo?.length}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
          </div>
          <div className="space-y-2">
            {(data?.vacinas_por_tipo || []).map((v, i) => <div key={i} className="flex justify-between text-sm border-b pb-1.5"><span className="capitalize">{v.tipo || "—"}</span><Badge variant="outline" className="font-mono">{v.total}</Badge></div>)}
            {!data?.vacinas_por_tipo?.length && <p className="text-sm text-muted-foreground py-4 text-center">Sem registros.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading text-lg font-bold mb-3">Resumo operacional</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-1.5"><span>Pacientes na fila (período)</span><span className="font-mono">{r.fila_total ?? 0}</span></div>
            <div className="flex justify-between border-b pb-1.5"><span>Faltas em agendamentos</span><span className="font-mono text-rose-600">{r.faltas ?? 0}</span></div>
            <div className="flex justify-between border-b pb-1.5"><span>Cancelamentos</span><span className="font-mono">{r.cancelamentos ?? 0}</span></div>
            <div className="flex justify-between border-b pb-1.5"><span className="flex items-center gap-1">Exames críticos <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /></span><span className="font-mono text-rose-600">{r.exames_criticos ?? 0}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
