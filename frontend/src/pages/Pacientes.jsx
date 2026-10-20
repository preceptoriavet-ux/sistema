import { useEffect, useState, useCallback } from "react";
import { api, formatApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ESPECIES, SEXOS, especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Pencil, AlertTriangle, Upload, History } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EMPTY = { tutor_id: "", nome: "", especie: "canino", raca: "", sexo: "macho", data_nascimento: "", idade_estimada: "", cor: "", peso: "", microchip: "", estado_reprodutivo: "", alergias: "", doencas_preexistentes: "", medicamentos_continuos: "", alertas: "", foto: "", situacao: "ativo" };

export default function Pacientes() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (query = "") => {
    const { data } = await api.get("/pacientes", { params: query ? { q: query } : {} });
    setRows(data);
  }, []);

  useEffect(() => { load(); api.get("/tutores").then((r) => setTutores(r.data)); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(q), 350); return () => clearTimeout(t); }, [q, load]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p }); setEditId(p.id); setOpen(true); };
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      field("foto", data.storage_path); toast.success("Foto enviada");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.tutor_id) return toast.error("Selecione o tutor");
    if (!form.nome.trim()) return toast.error("Informe o nome do animal");
    setSaving(true);
    try {
      if (editId) { await api.put(`/pacientes/${editId}`, form); toast.success("Paciente atualizado"); }
      else { await api.post("/pacientes", form); toast.success("Paciente cadastrado"); }
      setOpen(false); load(q);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Pacientes</h1><p className="text-sm text-muted-foreground">{rows.length} animal(is)</p></div>
        {can("pacientes:write") && <Button onClick={openNew} data-testid="novo-paciente-button"><Plus className="h-4 w-4 mr-1.5" />Novo Paciente</Button>}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nº de cadastro, animal, tutor ou microchip…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="paciente-search-input" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((p) => {
          const esp = especieLabel(p.especie);
          return (
            <Card key={p.id} className="p-4 flex gap-3" data-testid={`paciente-card-${p.id}`}>
              {p.foto ? (
                <img src={fileUrl(p.foto)} alt={p.nome} className="h-16 w-16 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="grid place-items-center h-16 w-16 rounded-lg bg-secondary text-2xl shrink-0">{esp.icon}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold truncate">{p.nome} <span className="font-mono text-xs font-semibold text-primary" data-testid={`paciente-codigo-${p.id}`}>Nº {p.codigo ?? "—"}</span></p>
                  {can("pacientes:write") && <button onClick={() => openEdit(p)} data-testid={`edit-paciente-${p.id}`}><Pencil className="h-4 w-4 text-muted-foreground" /></button>}
                </div>
                <p className="text-xs text-muted-foreground">{esp.label} · {p.raca || "SRD"}</p>
                <p className="text-xs text-muted-foreground truncate">Tutor: {p.tutor_nome} {p.tutor_codigo != null && <span className="font-mono">(Nº {p.tutor_codigo})</span>}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.peso && <Badge variant="outline" className="font-mono text-[10px]">{p.peso} kg</Badge>}
                  {p.alergias && <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-0.5" />Alergia</Badge>}
                </div>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => navigate(`/pacientes/${p.id}/historico`)} data-testid={`historico-paciente-${p.id}`}><History className="h-3.5 w-3.5 mr-1" />Linha do tempo</Button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-10">Nenhum paciente encontrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{editId ? "Editar Paciente" : "Novo Paciente"}
            <Badge variant="outline" className="font-mono" data-testid="paciente-codigo-ficha">{editId ? `Nº ${form.codigo ?? "—"}` : "Nº gerado ao salvar"}</Badge></DialogTitle></DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Identificação</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Tutor responsável *</Label>
              <Select value={form.tutor_id} onValueChange={(v) => field("tutor_id", v)}>
                <SelectTrigger data-testid="paciente-tutor-select"><SelectValue placeholder="Selecione o tutor" /></SelectTrigger>
                <SelectContent>{tutores.map((t) => <SelectItem key={t.id} value={t.id}>Nº {t.codigo} — {t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nome do animal *</Label><Input value={form.nome} onChange={(e) => field("nome", e.target.value)} data-testid="paciente-nome-input" /></div>
            <div><Label>Espécie</Label>
              <Select value={form.especie} onValueChange={(v) => field("especie", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESPECIES.map((e) => <SelectItem key={e.value} value={e.value}>{e.icon} {e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Raça</Label><Input value={form.raca} onChange={(e) => field("raca", e.target.value)} /></div>
            <div><Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => field("sexo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEXOS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data de nascimento</Label><Input type="date" value={form.data_nascimento} onChange={(e) => field("data_nascimento", e.target.value)} /></div>
            <div><Label>Idade estimada</Label><Input value={form.idade_estimada} onChange={(e) => field("idade_estimada", e.target.value)} placeholder="ex: 3 anos" /></div>
            <div><Label>Cor / características</Label><Input value={form.cor} onChange={(e) => field("cor", e.target.value)} /></div>
            <div><Label>Peso atual (kg)</Label><Input value={form.peso} onChange={(e) => field("peso", e.target.value)} /></div>
            <div><Label>Microchip</Label><Input value={form.microchip} onChange={(e) => field("microchip", e.target.value)} /></div>
            <div><Label>Estado reprodutivo</Label><Input value={form.estado_reprodutivo} onChange={(e) => field("estado_reprodutivo", e.target.value)} placeholder="Inteiro/Castrado" /></div>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-2">Histórico de Saúde</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Alergias</Label><Textarea value={form.alergias} onChange={(e) => field("alergias", e.target.value)} rows={2} /></div>
            <div><Label>Doenças preexistentes</Label><Textarea value={form.doencas_preexistentes} onChange={(e) => field("doencas_preexistentes", e.target.value)} rows={2} /></div>
            <div><Label>Medicamentos contínuos</Label><Textarea value={form.medicamentos_continuos} onChange={(e) => field("medicamentos_continuos", e.target.value)} rows={2} /></div>
            <div><Label>Alertas clínicos</Label><Textarea value={form.alertas} onChange={(e) => field("alertas", e.target.value)} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Fotografia do animal</Label>
              <div className="flex items-center gap-3 mt-1.5">
                {form.foto && <img src={fileUrl(form.foto)} alt="foto" className="h-12 w-12 rounded object-cover" />}
                <label className="inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-secondary" data-testid="paciente-foto-upload">
                  <Upload className="h-4 w-4" />{uploading ? "Enviando…" : "Enviar foto"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-paciente-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
