import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Activity, AlertTriangle, Clock } from "lucide-react";

const PRIOR = {
  emergencia: { l: "Emergência", c: "bg-rose-100 text-rose-800 border-rose-300" },
  urgente: { l: "Urgente", c: "bg-amber-100 text-amber-800 border-amber-300" },
  normal: { l: "Normal", c: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};
const EMPTY = { paciente_id: "", fila_id: "", queixa_principal: "", inicio_sinais: "", historico: "", temperatura: "", fc: "", fr: "", peso: "", dor: "", hidratacao: "", info_tutor: "", sinais_alerta: "", prioridade: "normal", observacoes: "" };

export default function Triagem() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [fila, setFila] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/triagem"); setRows(data); }, []);
  useEffect(() => {
    load();
    api.get("/pacientes").then((r) => setPacientes(r.data));
    api.get("/fila").then((r) => setFila(r.data)).catch(() => {});
  }, [load]);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setForm(EMPTY); setOpen(true); };

  const pickFila = (fid) => {
    const f = fila.find((x) => x.id === fid);
    if (f) setForm((p) => ({ ...p, fila_id: fid, paciente_id: f.paciente_id, queixa_principal: f.motivo || "" }));
  };

  const save = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    setSaving(true);
    try { await api.post("/triagem", form); toast.success("Triagem registrada e encaminhada ao prontuário"); setOpen(false); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Triagem Veterinária</h1><p className="text-sm text-muted-foreground">{rows.length} triagem(ns) registrada(s)</p></div>
        {can("triagem:write") && <Button onClick={openNew} data-testid="nova-triagem-button"><Plus className="h-4 w-4 mr-1.5" />Nova Triagem</Button>}
      </div>

      <div className="grid gap-3">
        {rows.map((t) => {
          const pr = PRIOR[t.prioridade] || PRIOR.normal;
          return (
            <Card key={t.id} className={`p-4 flex items-center gap-4 ${t.prioridade === "emergencia" ? "ring-2 ring-rose-300" : ""}`} data-testid={`triagem-${t.id}`}>
              <div className="grid place-items-center h-10 w-10 rounded-lg bg-secondary text-primary shrink-0"><Activity className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{especieLabel(t.especie).icon} {t.paciente_nome} <span className="font-normal text-muted-foreground">· {t.queixa_principal || "—"}</span></p>
                <p className="truncate text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(t.created_at).toLocaleString("pt-BR")}</span>
                  {t.temperatura && <span className="font-mono">T {t.temperatura}°C</span>}
                  {t.fc && <span className="font-mono">FC {t.fc}</span>}
                  {t.peso && <span className="font-mono">{t.peso}kg</span>}
                  <span>· {t.responsavel}</span>
                </p>
              </div>
              {t.sinais_alerta && <Badge className="bg-rose-100 text-rose-800 border-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Sinal de alerta</Badge>}
              <Badge variant="outline" className={pr.c}>{pr.l}</Badge>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma triagem registrada.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Triagem</DialogTitle></DialogHeader>
          {fila.length > 0 && (
            <div><Label>Paciente da fila (opcional)</Label>
              <Select value={form.fila_id} onValueChange={pickFila}>
                <SelectTrigger data-testid="triagem-fila-select"><SelectValue placeholder="Selecionar da fila de espera" /></SelectTrigger>
                <SelectContent>{fila.map((f) => <SelectItem key={f.id} value={f.id}>{f.paciente_nome} — {f.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Paciente *</Label>
            <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)}>
              <SelectTrigger data-testid="triagem-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Queixa</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Queixa principal</Label><Input value={form.queixa_principal} onChange={(e) => field("queixa_principal", e.target.value)} data-testid="triagem-queixa-input" /></div>
            <div><Label>Início dos sinais</Label><Input value={form.inicio_sinais} onChange={(e) => field("inicio_sinais", e.target.value)} placeholder="ex: há 2 dias" /></div>
            <div><Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => field("prioridade", v)}>
                <SelectTrigger data-testid="triagem-prioridade-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="urgente">Urgente</SelectItem><SelectItem value="emergencia">Emergência</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Histórico resumido</Label><Textarea rows={2} value={form.historico} onChange={(e) => field("historico", e.target.value)} /></div>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sinais Vitais</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div><Label>Temp (°C)</Label><Input value={form.temperatura} onChange={(e) => field("temperatura", e.target.value)} /></div>
            <div><Label>FC</Label><Input value={form.fc} onChange={(e) => field("fc", e.target.value)} /></div>
            <div><Label>FR</Label><Input value={form.fr} onChange={(e) => field("fr", e.target.value)} /></div>
            <div><Label>Peso (kg)</Label><Input value={form.peso} onChange={(e) => field("peso", e.target.value)} /></div>
            <div><Label>Dor (0-10)</Label><Input value={form.dor} onChange={(e) => field("dor", e.target.value)} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Hidratação</Label><Input value={form.hidratacao} onChange={(e) => field("hidratacao", e.target.value)} /></div>
            <div><Label>Informações do tutor</Label><Input value={form.info_tutor} onChange={(e) => field("info_tutor", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Sinais de alerta</Label><Textarea rows={2} value={form.sinais_alerta} onChange={(e) => field("sinais_alerta", e.target.value)} placeholder="Deixe em branco se não houver" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-triagem-button">{saving ? "Salvando…" : "Registrar e Encaminhar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
