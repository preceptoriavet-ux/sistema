import { useEffect, useState, useCallback } from "react";
import { api, formatApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Stethoscope, CheckCircle2, ShieldCheck, Clock } from "lucide-react";

const ST = { rascunho: { l: "Rascunho", c: "bg-slate-100 text-slate-700 border-slate-300" }, aguardando_revisao: { l: "Aguardando Revisão", c: "bg-amber-100 text-amber-800 border-amber-300" }, finalizado: { l: "Finalizado", c: "bg-emerald-100 text-emerald-800 border-emerald-300" }, validado: { l: "Validado", c: "bg-primary/10 text-primary border-primary/30" } };
const EMPTY = { paciente_id: "", motivo: "", queixa_principal: "", anamnese: "", exame_fisico: "", temperatura: "", fc: "", fr: "", peso: "", lista_problemas: "", hipoteses: "", diagnostico: "", plano_terapeutico: "", exames_solicitados: "", prescricoes: "", orientacoes: "", retorno: "" };

export default function Prontuarios() {
  const { user, can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [exames, setExames] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/prontuarios"); setRows(data); }, []);
  useEffect(() => { load(); api.get("/pacientes").then((r) => setPacientes(r.data)); }, [load]);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setForm(EMPTY); setEditId(null); setEditStatus(""); setExames([]); setOpen(true); };
  const openView = (r) => {
    setForm({ ...EMPTY, ...r }); setEditId(r.id); setEditStatus(r.status); setOpen(true);
    api.get(`/exames?paciente_id=${r.paciente_id}`).then((res) => setExames(res.data)).catch(() => setExames([]));
  };

  const save = async (finalizar) => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    setSaving(true);
    try {
      if (editId) await api.put(`/prontuarios/${editId}`, { ...form, finalizar, motivo_correcao: "Correção de registro" });
      else await api.post("/prontuarios", { ...form, finalizar });
      toast.success(finalizar ? "Prontuário finalizado" : "Prontuário salvo"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const validar = async () => { try { await api.post(`/prontuarios/${editId}/validar`); toast.success("Prontuário validado"); setOpen(false); load(); } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } };

  const locked = ["finalizado", "validado", "aguardando_revisao"].includes(editStatus);
  const canValidate = editStatus === "aguardando_revisao" && ["veterinario", "admin", "gestor"].includes(user?.role);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Prontuários Clínicos</h1><p className="text-sm text-muted-foreground">{rows.length} registro(s)</p></div>
        {can("prontuario:write") && <Button onClick={openNew} data-testid="novo-prontuario-button"><Plus className="h-4 w-4 mr-1.5" />Novo Prontuário</Button>}
      </div>

      <div className="grid gap-3">
        {rows.map((r) => {
          const st = ST[r.status] || ST.rascunho;
          return (
            <Card key={r.id} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/80" onClick={() => openView(r)} data-testid={`prontuario-${r.id}`}>
              <div className="grid place-items-center h-10 w-10 rounded-lg bg-secondary text-primary shrink-0"><Stethoscope className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{r.paciente_nome} <span className="font-normal text-muted-foreground">· {r.diagnostico || r.queixa_principal || r.motivo || "Consulta"}</span></p>
                <p className="truncate text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.created_at).toLocaleString("pt-BR")} · {r.profissional_nome}</p>
              </div>
              <Badge variant="outline" className={st.c}>{st.l}</Badge>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhum prontuário registrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{editId ? "Prontuário" : "Novo Prontuário"} {editStatus && <Badge variant="outline" className={(ST[editStatus] || ST.rascunho).c}>{(ST[editStatus] || ST.rascunho).l}</Badge>}</DialogTitle></DialogHeader>
          {!editId && (
            <div><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)}>
                <SelectTrigger data-testid="prontuario-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{especieLabel(p.especie).icon} {p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <Tabs defaultValue="anamnese">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="anamnese" data-testid="tab-anamnese">Anamnese</TabsTrigger>
              <TabsTrigger value="exame">Exame Físico</TabsTrigger>
              <TabsTrigger value="conduta">Avaliação & Conduta</TabsTrigger>
            </TabsList>
            <TabsContent value="anamnese" className="space-y-3 pt-2">
              <div><Label>Motivo da consulta</Label><Input value={form.motivo} onChange={(e) => field("motivo", e.target.value)} disabled={locked} /></div>
              <div><Label>Queixa principal</Label><Input value={form.queixa_principal} onChange={(e) => field("queixa_principal", e.target.value)} disabled={locked} data-testid="prontuario-queixa-input" /></div>
              <div><Label>Histórico / Anamnese</Label><Textarea rows={5} value={form.anamnese} onChange={(e) => field("anamnese", e.target.value)} disabled={locked} /></div>
            </TabsContent>
            <TabsContent value="exame" className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><Label>Temp. (°C)</Label><Input value={form.temperatura} onChange={(e) => field("temperatura", e.target.value)} disabled={locked} /></div>
                <div><Label>FC (bpm)</Label><Input value={form.fc} onChange={(e) => field("fc", e.target.value)} disabled={locked} /></div>
                <div><Label>FR (mpm)</Label><Input value={form.fr} onChange={(e) => field("fr", e.target.value)} disabled={locked} /></div>
                <div><Label>Peso (kg)</Label><Input value={form.peso} onChange={(e) => field("peso", e.target.value)} disabled={locked} /></div>
              </div>
              <div><Label>Achados do exame físico</Label><Textarea rows={6} value={form.exame_fisico} onChange={(e) => field("exame_fisico", e.target.value)} disabled={locked} /></div>
            </TabsContent>
            <TabsContent value="conduta" className="space-y-3 pt-2">
              <div><Label>Lista de problemas</Label><Textarea rows={2} value={form.lista_problemas} onChange={(e) => field("lista_problemas", e.target.value)} disabled={locked} /></div>
              <div><Label>Hipóteses diagnósticas</Label><Textarea rows={2} value={form.hipoteses} onChange={(e) => field("hipoteses", e.target.value)} disabled={locked} /></div>
              <div><Label>Diagnóstico</Label><Input value={form.diagnostico} onChange={(e) => field("diagnostico", e.target.value)} disabled={locked} /></div>
              <div><Label>Exames solicitados</Label><Textarea rows={2} value={form.exames_solicitados} onChange={(e) => field("exames_solicitados", e.target.value)} disabled={locked} /></div>
              <div><Label>Plano terapêutico</Label><Textarea rows={3} value={form.plano_terapeutico} onChange={(e) => field("plano_terapeutico", e.target.value)} disabled={locked} /></div>
              <div><Label>Prescrições</Label><Textarea rows={3} value={form.prescricoes} onChange={(e) => field("prescricoes", e.target.value)} disabled={locked} /></div>
              <div><Label>Orientações ao tutor</Label><Textarea rows={2} value={form.orientacoes} onChange={(e) => field("orientacoes", e.target.value)} disabled={locked} /></div>
              <div><Label>Retorno</Label><Input value={form.retorno} onChange={(e) => field("retorno", e.target.value)} disabled={locked} placeholder="ex: 15 dias" /></div>
              {editId && exames.length > 0 && (
                <div className="rounded-lg border bg-secondary/40 p-3" data-testid="prontuario-exames-section">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Exames do Paciente</p>
                  <div className="space-y-2">
                    {exames.map((ex) => (
                      <div key={ex.id} className="rounded-md border bg-card p-2.5 text-sm" data-testid={`prontuario-exame-${ex.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{ex.tipo}{ex.critico && <Badge className="ml-1.5 bg-rose-100 text-rose-800 border-rose-300 text-[10px]">Crítico</Badge>}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{ex.status}</Badge>
                            {ex.laudo_path && <a href={fileUrl(ex.laudo_path)} target="_blank" rel="noreferrer" className="text-xs text-primary" data-testid={`prontuario-laudo-${ex.id}`}>Laudo</a>}
                          </div>
                        </div>
                        {ex.resultado && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ex.resultado}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
          {locked && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Registro finalizado. Correções são rastreadas e não apagam o histórico.</p>}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            {canValidate && <Button onClick={validar} data-testid="validar-prontuario-button"><ShieldCheck className="h-4 w-4 mr-1.5" />Validar</Button>}
            {can("prontuario:write") && (locked ? (
              <Button onClick={() => save(false)} disabled={saving} data-testid="corrigir-prontuario-button">Salvar Correção</Button>
            ) : (<>
              <Button variant="secondary" onClick={() => save(false)} disabled={saving} data-testid="salvar-rascunho-button">Salvar Rascunho</Button>
              <Button onClick={() => save(true)} disabled={saving} data-testid="finalizar-prontuario-button"><CheckCircle2 className="h-4 w-4 mr-1.5" />Finalizar</Button>
            </>))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
