import { useEffect, useState, useCallback } from "react";
import { api, formatApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel, TIPOS_DOCUMENTO } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Printer } from "lucide-react";

const EMPTY = { paciente_id: "", tipo: "receita", medicamentos: "", corpo: "" };

export default function Documentos() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/documentos"); setRows(data); }, []);
  useEffect(() => { load(); api.get("/pacientes").then((r) => setPacientes(r.data)); }, [load]);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const tipoCfg = TIPOS_DOCUMENTO.find((t) => t.value === form.tipo);

  const save = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    if (!form.corpo.trim() && !form.medicamentos.trim()) return toast.error("Preencha o conteúdo do documento");
    setSaving(true);
    try {
      const { data } = await api.post("/documentos", form);
      toast.success("Documento gerado");
      setOpen(false); load();
      window.open(fileUrl(data.pdf_path), "_blank");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Documentos Clínicos</h1><p className="text-sm text-muted-foreground">{rows.length} documento(s) emitido(s)</p></div>
        {can("prontuario:write") && <Button onClick={openNew} data-testid="novo-documento-button"><Plus className="h-4 w-4 mr-1.5" />Emitir Documento</Button>}
      </div>

      <div className="grid gap-3">
        {rows.map((d) => (
          <Card key={d.id} className="p-4 flex items-center gap-4" data-testid={`documento-${d.id}`}>
            <div className="grid place-items-center h-10 w-10 rounded-lg bg-secondary text-primary shrink-0"><FileText className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{d.titulo} <span className="font-normal text-muted-foreground">· {d.paciente_nome}</span></p>
              <p className="truncate text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")} · {d.profissional_nome}</p>
            </div>
            <Badge variant="outline">{d.tipo}</Badge>
            <a href={fileUrl(d.pdf_path)} target="_blank" rel="noreferrer" data-testid={`documento-pdf-${d.id}`}>
              <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1.5" />Abrir PDF</Button>
            </a>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum documento emitido.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Emitir Documento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)}>
                <SelectTrigger data-testid="documento-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{especieLabel(p.especie).icon} {p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo de documento</Label>
              <Select value={form.tipo} onValueChange={(v) => field("tipo", v)}>
                <SelectTrigger data-testid="documento-tipo-select"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {tipoCfg?.medicamentos && (
              <div><Label>Medicamentos / Prescrição</Label>
                <Textarea rows={5} value={form.medicamentos} onChange={(e) => field("medicamentos", e.target.value)} data-testid="documento-medicamentos-input"
                  placeholder={"1) Amoxicilina 250mg — 1 comp. VO a cada 12h por 7 dias\n2) ..."} />
              </div>
            )}
            <div><Label>{tipoCfg?.medicamentos ? "Orientações" : "Conteúdo"}</Label>
              <Textarea rows={6} value={form.corpo} onChange={(e) => field("corpo", e.target.value)} data-testid="documento-corpo-input"
                placeholder="Digite o texto do documento…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-documento-button">{saving ? "Gerando…" : "Gerar PDF"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
