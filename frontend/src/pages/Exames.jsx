import { useEffect, useState, useCallback } from "react";
import { api, formatApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FlaskConical, Upload, FileText, AlertTriangle, Pencil } from "lucide-react";

const STATUS = {
  solicitado: { l: "Solicitado", c: "bg-slate-100 text-slate-700 border-slate-300" },
  coletado: { l: "Coletado", c: "bg-sky-100 text-sky-800 border-sky-300" },
  em_processamento: { l: "Em Processamento", c: "bg-amber-100 text-amber-800 border-amber-300" },
  concluido: { l: "Concluído", c: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelado: { l: "Cancelado", c: "bg-gray-100 text-gray-600 border-gray-300" },
};
const EMPTY = { paciente_id: "", tipo: "", categoria: "laboratorial", laboratorio: "", data_coleta: "", status: "solicitado", resultado: "", critico: false, laudo_path: "", laudo_nome: "", observacoes: "" };

export default function Exames() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/exames"); setRows(data); }, []);
  useEffect(() => { load(); api.get("/pacientes").then((r) => setPacientes(r.data)); }, [load]);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (e) => { setForm({ ...EMPTY, ...e }); setEditId(e.id); setOpen(true); };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, laudo_path: data.storage_path, laudo_nome: data.filename }));
      toast.success("Laudo anexado");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    if (!form.tipo.trim()) return toast.error("Informe o tipo de exame");
    setSaving(true);
    try {
      if (editId) await api.put(`/exames/${editId}`, form);
      else await api.post("/exames", form);
      toast.success("Exame salvo"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Exames Laboratoriais e de Imagem</h1><p className="text-sm text-muted-foreground">{rows.length} exame(s)</p></div>
        {can("exame:write") && <Button onClick={openNew} data-testid="novo-exame-button"><Plus className="h-4 w-4 mr-1.5" />Solicitar Exame</Button>}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Paciente</TableHead><TableHead>Exame</TableHead><TableHead className="hidden md:table-cell">Laboratório</TableHead><TableHead>Status</TableHead><TableHead>Laudo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => {
              const st = STATUS[e.status] || STATUS.solicitado;
              return (
                <TableRow key={e.id} className={e.critico ? "bg-rose-50/60" : ""} data-testid={`exame-row-${e.id}`}>
                  <TableCell className="text-sm font-medium">{especieLabel(e.especie).icon} {e.paciente_nome}</TableCell>
                  <TableCell className="text-sm">{e.tipo}{e.critico && <Badge className="ml-1.5 bg-rose-100 text-rose-800 border-rose-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-0.5" />Crítico</Badge>}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{e.laboratorio || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={st.c}>{st.l}</Badge></TableCell>
                  <TableCell>{e.laudo_path ? <a href={fileUrl(e.laudo_path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary" data-testid={`laudo-link-${e.id}`}><FileText className="h-4 w-4" />Ver</a> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">{can("exame:write") && <Button variant="ghost" size="icon" onClick={() => openEdit(e)} data-testid={`edit-exame-${e.id}`}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum exame registrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Exame" : "Solicitar Exame"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)} disabled={!!editId}>
                <SelectTrigger data-testid="exame-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo de exame *</Label><Input value={form.tipo} onChange={(e) => field("tipo", e.target.value)} placeholder="ex: Hemograma" data-testid="exame-tipo-input" /></div>
            <div><Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => field("categoria", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="laboratorial">Laboratorial</SelectItem><SelectItem value="imagem">Imagem</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Laboratório / Prestador</Label><Input value={form.laboratorio} onChange={(e) => field("laboratorio", e.target.value)} /></div>
            <div><Label>Data da coleta</Label><Input type="date" value={form.data_coleta} onChange={(e) => field("data_coleta", e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => field("status", v)}>
                <SelectTrigger data-testid="exame-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3"><Label>Resultado crítico</Label><Switch checked={form.critico} onCheckedChange={(v) => field("critico", v)} data-testid="exame-critico-switch" /></div>
            <div className="sm:col-span-2"><Label>Resultado</Label><Textarea rows={3} value={form.resultado} onChange={(e) => field("resultado", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Laudo (PDF/imagem)</Label>
              <div className="flex items-center gap-3 mt-1.5">
                {form.laudo_path && <span className="inline-flex items-center gap-1 text-sm text-primary"><FileText className="h-4 w-4" />{form.laudo_nome || "anexado"}</span>}
                <label className="inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-secondary" data-testid="exame-laudo-upload">
                  <Upload className="h-4 w-4" />{uploading ? "Enviando…" : "Anexar laudo"}
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
                </label>
              </div>
            </div>
            <div className="sm:col-span-2"><Label>Observações / Pendências</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => field("observacoes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-exame-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
