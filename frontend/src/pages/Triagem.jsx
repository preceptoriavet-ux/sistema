import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayCircle, Activity, AlertTriangle, Clock, Pencil, Trash2, CheckCircle2, History } from "lucide-react";
import { TriagemFicha } from "@/components/TriagemFicha";

const PRIOR = {
  emergencia: { l: "Emergência", c: "bg-rose-100 text-rose-800 border-rose-300" },
  urgente: { l: "Urgente", c: "bg-amber-100 text-amber-800 border-amber-300" },
  normal: { l: "Normal", c: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};
const STATUS = {
  em_andamento: { l: "Em andamento", c: "bg-sky-100 text-sky-800 border-sky-300" },
  concluida: { l: "Concluída", c: "bg-slate-100 text-slate-700 border-slate-300" },
};
const statusOf = (t) => t.status || "concluida";

const TriagemCard = ({ t, canWrite, onEdit, onDelete }) => {
  const pr = PRIOR[t.prioridade] || PRIOR.normal;
  const st = STATUS[statusOf(t)];
  return (
    <Card className={`p-4 flex flex-wrap items-center gap-4 ${t.prioridade === "emergencia" ? "ring-2 ring-rose-300" : ""}`} data-testid={`triagem-${t.id}`}>
      <div className="grid place-items-center h-10 w-10 rounded-lg bg-secondary text-primary shrink-0"><Activity className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{especieLabel(t.especie).icon} {t.paciente_nome} <span className="font-normal text-muted-foreground">· {t.queixa_principal || "—"}</span></p>
        <p className="truncate text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(t.created_at).toLocaleString("pt-BR")}</span>
          {t.temperatura && <span className="font-mono">T {t.temperatura}°C</span>}
          {t.fc && <span className="font-mono">FC {t.fc}</span>}
          {t.peso && <span className="font-mono">{t.peso}kg</span>}
          <span>· {t.responsavel}</span>
          {t.alteracoes?.length > 0 && <span className="flex items-center gap-1 text-amber-700"><History className="h-3 w-3" />{t.alteracoes.length} alteração(ões)</span>}
        </p>
      </div>
      {t.sinais_alerta && <Badge className="bg-rose-100 text-rose-800 border-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Sinal de alerta</Badge>}
      <Badge variant="outline" className={st.c} data-testid={`triagem-status-${t.id}`}>{st.l}</Badge>
      <Badge variant="outline" className={pr.c}>{pr.l}</Badge>
      {canWrite && (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => onEdit(t)} data-testid={`alterar-triagem-${t.id}`}><Pencil className="h-3.5 w-3.5 mr-1" />{statusOf(t) === "em_andamento" ? "Continuar" : "Alterar"}</Button>
          <Button size="sm" variant="outline" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => onDelete(t)} data-testid={`excluir-triagem-${t.id}`}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>
        </div>
      )}
    </Card>
  );
};

export default function Triagem() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [fila, setFila] = useState([]);
  const [startOpen, setStartOpen] = useState(false);
  const [start, setStart] = useState({ paciente_id: "", fila_id: "" });
  const [ficha, setFicha] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get("/triagem"); setRows(data); }, []);
  const loadFila = () => api.get("/fila").then((r) => setFila(r.data.filter((f) => ["aguardando_recepcao", "aguardando_triagem"].includes(f.status)))).catch(() => {});
  useEffect(() => { load(); loadFila(); api.get("/pacientes").then((r) => setPacientes(r.data)); }, [load]);

  const field = (k, v) => setFicha((f) => ({ ...f, [k]: v }));
  const err = (e) => toast.error(formatApiError(e.response?.data?.detail));

  const pickFila = (fid) => {
    const f = fila.find((x) => x.id === fid);
    if (f) setStart({ fila_id: fid, paciente_id: f.paciente_id, queixa_principal: f.motivo || "" });
  };

  const iniciar = async () => {
    if (!start.paciente_id) return toast.error("Selecione o paciente");
    setSaving(true);
    try {
      const { data } = await api.post("/triagem", start);
      toast.success("Triagem iniciada"); setStartOpen(false); setFicha(data); load(); loadFila();
    } catch (e) { err(e); } finally { setSaving(false); }
  };

  const run = async (fn, msg, keepOpen) => {
    setSaving(true);
    try { const { data } = await fn(); toast.success(msg); setFicha(keepOpen ? data : null); load(); loadFila(); }
    catch (e) { err(e); } finally { setSaving(false); }
  };
  const salvar = () => {
    const concluida = statusOf(ficha) === "concluida";
    run(() => api.put(`/triagem/${ficha.id}`, ficha), concluida ? "Alteração registrada no histórico" : "Ficha salva", !concluida);
  };
  const concluir = () => run(() => api.post(`/triagem/${ficha.id}/concluir`, ficha), "Triagem concluída e encaminhada ao prontuário");
  const excluir = async () => {
    try { await api.delete(`/triagem/${toDelete.id}`); toast.success("Triagem excluída"); setToDelete(null); load(); }
    catch (e) { err(e); }
  };

  const emAndamento = ficha && statusOf(ficha) === "em_andamento";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Triagem Veterinária</h1><p className="text-sm text-muted-foreground">{rows.length} triagem(ns) registrada(s)</p></div>
        {can("triagem:write") && <Button onClick={() => { setStart({ paciente_id: "", fila_id: "" }); setStartOpen(true); }} data-testid="iniciar-triagem-button"><PlayCircle className="h-4 w-4 mr-1.5" />Iniciar Triagem</Button>}
      </div>

      <div className="grid gap-3">
        {rows.map((t) => <TriagemCard key={t.id} t={t} canWrite={can("triagem:write")} onEdit={(x) => setFicha({ ...x })} onDelete={setToDelete} />)}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma triagem registrada.</p>}
      </div>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Iniciar Triagem</DialogTitle></DialogHeader>
          {fila.length > 0 && (
            <div><Label>Paciente da fila (opcional)</Label>
              <Select value={start.fila_id} onValueChange={pickFila}>
                <SelectTrigger data-testid="triagem-fila-select"><SelectValue placeholder="Selecionar da fila de espera" /></SelectTrigger>
                <SelectContent>{fila.map((f) => <SelectItem key={f.id} value={f.id}>{f.paciente_nome} — {f.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Paciente *</Label>
            <Select value={start.paciente_id} onValueChange={(v) => setStart((s) => ({ ...s, paciente_id: v, fila_id: fila.find((f) => f.id === s.fila_id)?.paciente_id === v ? s.fila_id : "" }))}>
              <SelectTrigger data-testid="triagem-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancelar</Button>
            <Button onClick={iniciar} disabled={saving} data-testid="confirmar-iniciar-triagem-button"><PlayCircle className="h-4 w-4 mr-1.5" />{saving ? "Iniciando…" : "Iniciar e preencher ficha"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ficha} onOpenChange={(o) => !o && setFicha(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {ficha && <>
            <DialogHeader><DialogTitle className="flex items-center gap-2">Ficha de Triagem — {ficha.paciente_nome}
              <Badge variant="outline" className={STATUS[statusOf(ficha)].c} data-testid="ficha-triagem-status">{STATUS[statusOf(ficha)].l}</Badge></DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Iniciada em {new Date(ficha.iniciado_at || ficha.created_at).toLocaleString("pt-BR")} · {ficha.responsavel}</p>
            <TriagemFicha form={ficha} field={field} />
            {!emAndamento && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2" data-testid="triagem-alteracao-aviso">Triagem concluída. Alterações ficam registradas no histórico e na auditoria.</p>}
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setFicha(null)}>Fechar</Button>
              <Button variant="secondary" onClick={salvar} disabled={saving} data-testid="salvar-triagem-button">{emAndamento ? "Salvar Ficha" : "Salvar Alteração"}</Button>
              {emAndamento && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={concluir} disabled={saving} data-testid="concluir-triagem-button"><CheckCircle2 className="h-4 w-4 mr-1.5" />Concluir Triagem</Button>}
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir triagem?</AlertDialogTitle>
            <AlertDialogDescription>A triagem de {toDelete?.paciente_nome} será excluída. O prontuário vinculado será mantido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancelar-excluir-triagem">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={excluir} data-testid="confirmar-excluir-triagem">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
