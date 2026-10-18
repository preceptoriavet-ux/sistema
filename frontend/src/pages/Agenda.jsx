import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { TIPOS_AGENDAMENTO, AG_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";

const toDate = (d) => d.toISOString().slice(0, 10);
const STATUS_COLOR = { agendado: "border-l-slate-400", confirmado: "border-l-sky-500", em_atendimento: "border-l-blue-600", concluido: "border-l-emerald-600", falta: "border-l-rose-500", cancelado: "border-l-gray-300" };

export default function Agenda() {
  const { can } = useAuth();
  const [day, setDay] = useState(new Date());
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profs, setProfs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ paciente_id: "", profissional_id: "", tipo: "consulta", sala: "", motivo: "", hora: "09:00", duracao: 30, status: "agendado" });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const ds = toDate(day);
    const { data } = await api.get("/agendamentos", { params: { data_ini: ds, data_fim: ds } });
    setRows(data);
  }, [day]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/pacientes").then((r) => setPacientes(r.data)); api.get("/profissionais").then((r) => setProfs(r.data)); }, []);

  const shift = (n) => { const d = new Date(day); d.setDate(d.getDate() + n); setDay(d); };
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ paciente_id: "", profissional_id: "", tipo: "consulta", sala: "", motivo: "", hora: "09:00", duracao: 30, status: "agendado" }); setEditId(null); setOpen(true); };
  const openEdit = (a) => { setForm({ paciente_id: a.paciente_id, profissional_id: a.profissional_id, tipo: a.tipo, sala: a.sala, motivo: a.motivo, hora: a.inicio?.slice(11, 16), duracao: 30, status: a.status }); setEditId(a.id); setOpen(true); };

  const save = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    const ds = toDate(day);
    const inicio = `${ds}T${form.hora}:00`;
    const [h, m] = form.hora.split(":").map(Number);
    const end = new Date(day); end.setHours(h, m + Number(form.duracao || 30), 0, 0);
    const fim = `${ds}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`;
    const prof = profs.find((p) => p.id === form.profissional_id);
    const payload = { paciente_id: form.paciente_id, profissional_id: form.profissional_id, profissional_nome: prof?.nome || "", tipo: form.tipo, sala: form.sala, motivo: form.motivo, inicio, fim, status: form.status };
    setSaving(true);
    try {
      if (editId) await api.put(`/agendamentos/${editId}`, payload);
      else await api.post("/agendamentos", payload);
      toast.success("Agendamento salvo"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize">{day.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} data-testid="agenda-prev-day"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setDay(new Date())} data-testid="agenda-today">Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} data-testid="agenda-next-day"><ChevronRight className="h-4 w-4" /></Button>
          {can("agenda:write") && <Button onClick={openNew} data-testid="novo-agendamento-button"><Plus className="h-4 w-4 mr-1.5" />Agendar</Button>}
        </div>
      </div>

      <Card className="p-4 space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum agendamento para este dia.</p>}
        {rows.map((a) => (
          <div key={a.id} className={`flex items-center gap-3 rounded-lg border border-l-4 ${STATUS_COLOR[a.status] || "border-l-slate-400"} p-3 ${can("agenda:write") ? "cursor-pointer hover:bg-slate-50" : ""}`} onClick={() => can("agenda:write") && openEdit(a)} data-testid={`agendamento-${a.id}`}>
            <div className="flex items-center gap-1 text-sm font-mono font-semibold text-primary w-28 shrink-0">
              <Clock className="h-3.5 w-3.5" />{a.inicio?.slice(11, 16)}–{a.fim?.slice(11, 16)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{a.paciente_nome} <span className="text-muted-foreground font-normal">· {a.tutor_nome}</span></p>
              <p className="truncate text-xs text-muted-foreground">{a.tipo} · {a.profissional_nome || "Sem profissional"} {a.sala && `· ${a.sala}`}</p>
            </div>
            <Badge variant="outline">{AG_STATUS.find((s) => s.value === a.status)?.label || a.status}</Badge>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)}>
                <SelectTrigger data-testid="agendamento-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horário</Label><Input type="time" value={form.hora} onChange={(e) => field("hora", e.target.value)} data-testid="agendamento-hora-input" /></div>
              <div><Label>Duração (min)</Label><Input type="number" value={form.duracao} onChange={(e) => field("duracao", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => field("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_AGENDAMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Sala / Consultório</Label><Input value={form.sala} onChange={(e) => field("sala", e.target.value)} /></div>
            </div>
            <div><Label>Profissional</Label>
              <Select value={form.profissional_id} onValueChange={(v) => field("profissional_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editId && <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => field("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AG_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            <div><Label>Motivo</Label><Textarea value={form.motivo} onChange={(e) => field("motivo", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-agendamento-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
