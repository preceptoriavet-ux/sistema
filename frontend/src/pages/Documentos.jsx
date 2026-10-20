import { useEffect, useState, useCallback } from "react";
import { api, formatApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Printer } from "lucide-react";
import { EmitirDocumentoCampos, DOC_VAZIO } from "@/components/documentos/EmitirDocumentoCampos";
import { ModelosTab } from "@/components/documentos/ModelosTab";

export default function Documentos() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...DOC_VAZIO, paciente_id: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/documentos"); setRows(data); }, []);
  const loadModelos = useCallback(() => api.get("/modelos-documento").then((r) => setModelos(r.data)), []);
  useEffect(() => { load(); loadModelos(); api.get("/pacientes").then((r) => setPacientes(r.data)); }, [load, loadModelos]);

  const openNew = () => { setForm({ ...DOC_VAZIO, paciente_id: "" }); setOpen(true); };

  const save = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    if (!form.corpo.trim() && !form.medicamentos.trim()) return toast.error("Preencha o conteúdo do documento");
    setSaving(true);
    try {
      const { data } = await api.post("/documentos", form);
      toast.success("Documento gerado — registrado na linha do tempo do paciente");
      setOpen(false); load();
      window.open(fileUrl(data.pdf_path), "_blank");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Documentos Clínicos</h1><p className="text-sm text-muted-foreground">{rows.length} documento(s) emitido(s) · {modelos.length} modelo(s)</p></div>
        {can("prontuario:write") && <Button onClick={openNew} data-testid="novo-documento-button"><Plus className="h-4 w-4 mr-1.5" />Emitir Documento</Button>}
      </div>

      <Tabs defaultValue="emitidos">
        <TabsList><TabsTrigger value="emitidos" data-testid="tab-documentos-emitidos">Emitidos</TabsTrigger><TabsTrigger value="modelos" data-testid="tab-documentos-modelos">Modelos</TabsTrigger></TabsList>
        <TabsContent value="emitidos" className="grid gap-3 pt-2">
          {rows.map((d) => (
            <Card key={d.id} className="p-4 flex items-center gap-4" data-testid={`documento-${d.id}`}>
              <div className="grid place-items-center h-10 w-10 rounded-lg bg-secondary text-primary shrink-0"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{d.titulo} <span className="font-normal text-muted-foreground">· {d.paciente_nome}{d.paciente_codigo != null && ` (Nº ${d.paciente_codigo})`}</span></p>
                <p className="truncate text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")} · {d.profissional_nome}{d.prontuario_id ? " · via prontuário" : " · avulso"}</p>
              </div>
              <Badge variant="outline">{d.tipo === "modelo" ? "modelo" : d.tipo}</Badge>
              <a href={fileUrl(d.pdf_path)} target="_blank" rel="noreferrer" data-testid={`documento-pdf-${d.id}`}>
                <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1.5" />Abrir PDF</Button>
              </a>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum documento emitido.</p>}
        </TabsContent>
        <TabsContent value="modelos" className="pt-2"><ModelosTab modelos={modelos} reload={loadModelos} canWrite={can("prontuario:write")} /></TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Emitir Documento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => setForm((f) => ({ ...f, paciente_id: v }))}>
                <SelectTrigger data-testid="documento-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{especieLabel(p.especie).icon} Nº {p.codigo} — {p.nome} ({p.tutor_nome})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <EmitirDocumentoCampos form={form} setForm={setForm} modelos={modelos} prefix="documento" />
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
