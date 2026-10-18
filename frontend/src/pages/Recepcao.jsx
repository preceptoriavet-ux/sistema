import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { FILA_STATUS, filaStatus, especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, ArrowRight, Clock } from "lucide-react";

const COLUMNS = FILA_STATUS.filter((s) => !["concluido", "falta", "cancelado"].includes(s.value));
const nextStatus = (s) => { const i = COLUMNS.findIndex((c) => c.value === s); return i >= 0 && i < COLUMNS.length - 1 ? COLUMNS[i + 1].value : "concluido"; };
const elapsed = (iso) => { const m = Math.floor((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60}m`; };

export default function Recepcao() {
  const { can } = useAuth();
  const [fila, setFila] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ paciente_id: "", motivo: "", tipo: "espontaneo", prioridade: "normal" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/fila"); setFila(data); }, []);
  useEffect(() => { load(); api.get("/pacientes").then((r) => setPacientes(r.data)); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const checkin = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    setSaving(true);
    try { await api.post("/fila", form); toast.success("Paciente na fila"); setOpen(false); setForm({ paciente_id: "", motivo: "", tipo: "espontaneo", prioridade: "normal" }); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const advance = async (f) => { try { await api.put(`/fila/${f.id}`, { status: nextStatus(f.status) }); load(); } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } };
  const setStatus = async (f, status) => { try { await api.put(`/fila/${f.id}`, { status }); toast.success("Atualizado"); load(); } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Fila de Atendimento</h1><p className="text-sm text-muted-foreground">{fila.length} paciente(s) em atendimento</p></div>
        {can("fila:write") && <Button onClick={() => setOpen(true)} data-testid="checkin-button"><Plus className="h-4 w-4 mr-1.5" />Registrar Chegada</Button>}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="fila-kanban-board">
        {COLUMNS.map((col) => {
          const items = fila.filter((f) => f.status === col.value);
          return (
            <div key={col.value} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</p>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {items.map((f) => (
                  <div key={f.id} className={`rounded-lg border bg-card p-3 shadow-sm ${f.prioridade === "emergencia" ? "ring-2 ring-rose-400" : ""}`} data-testid={`fila-card-${f.id}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{especieLabel(f.especie).icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{f.paciente_nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{f.tutor_nome}</p>
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{elapsed(f.chegada)}</span>
                    </div>
                    {f.motivo && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{f.motivo}</p>}
                    {f.prioridade === "emergencia" && <Badge className="mt-1.5 bg-rose-100 text-rose-800 border-rose-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-0.5" />Emergência</Badge>}
                    {can("fila:write") && (
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => advance(f)} data-testid={`advance-${f.id}`}>Avançar <ArrowRight className="h-3 w-3 ml-1" /></Button>
                        <Select onValueChange={(v) => setStatus(f, v)}>
                          <SelectTrigger className="h-7 w-7 p-0 justify-center" data-testid={`fila-status-${f.id}`}><span className="text-xs">⋯</span></SelectTrigger>
                          <SelectContent>{FILA_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Chegada</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)}>
                <SelectTrigger data-testid="checkin-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => field("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="agendado">Agendado</SelectItem><SelectItem value="espontaneo">Espontâneo</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => field("prioridade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="emergencia">Emergência</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Motivo da visita</Label><Textarea value={form.motivo} onChange={(e) => field("motivo", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={checkin} disabled={saving} data-testid="save-checkin-button">{saving ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
