import { useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { FilePlus2, Pencil, Trash2, FileSignature } from "lucide-react";
import { VariaveisChips, inserirNoCursor } from "./Variaveis";

const VAZIO = { titulo: "", conteudo: "" };

export const ModelosTab = ({ modelos, reload, canWrite }) => {
  const [form, setForm] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const salvar = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) return toast.error("Informe o título e o conteúdo do modelo");
    setSaving(true);
    try {
      if (form.id) await api.put(`/modelos-documento/${form.id}`, form); else await api.post("/modelos-documento", form);
      toast.success(form.id ? "Modelo atualizado" : "Modelo criado — disponível no prontuário"); setForm(null); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  const excluir = async () => {
    try { await api.delete(`/modelos-documento/${toDelete.id}`); toast.success("Modelo excluído"); setToDelete(null); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-3" data-testid="modelos-tab">
      {canWrite && <Button onClick={() => setForm({ ...VAZIO })} data-testid="criar-modelo-button"><FilePlus2 className="h-4 w-4 mr-1.5" />Criar Modelo do Zero</Button>}
      <div className="grid gap-3 md:grid-cols-2">
        {modelos.map((m) => (
          <Card key={m.id} className="p-4 space-y-2" data-testid={`modelo-${m.id}`}>
            <div className="flex items-start gap-3">
              <div className="grid place-items-center h-9 w-9 rounded-lg bg-secondary text-primary shrink-0"><FileSignature className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{m.titulo}</p><p className="text-xs text-muted-foreground">por {m.created_by} · {new Date(m.updated_at || m.created_at).toLocaleDateString("pt-BR")}</p></div>
              {canWrite && <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setForm({ ...m })} data-testid={`editar-modelo-${m.id}`}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-700 hover:bg-rose-50" onClick={() => setToDelete(m)} data-testid={`excluir-modelo-${m.id}`}><Trash2 className="h-4 w-4" /></Button>
              </div>}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{m.conteudo}</p>
          </Card>
        ))}
      </div>
      {modelos.length === 0 && <p className="text-sm text-muted-foreground text-center py-10" data-testid="modelos-vazio">Nenhum modelo criado ainda.</p>}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {form && <>
            <DialogHeader><DialogTitle>{form.id ? "Editar Modelo" : "Criar Modelo do Zero"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Título do documento *</Label><Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="ex: Termo de Consentimento para Cirurgia" data-testid="modelo-titulo-input" /></div>
              <div className="space-y-1.5"><Label>Conteúdo do documento *</Label>
                <Textarea ref={ref} rows={14} value={form.conteudo} onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))} placeholder="Digite livremente o texto do documento…" data-testid="modelo-conteudo-input" />
                <VariaveisChips onInsert={(v) => inserirNoCursor(ref, form.conteudo, (val) => setForm((f) => ({ ...f, conteudo: val })), v)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving} data-testid="salvar-modelo-button">{saving ? "Salvando…" : "Salvar Modelo"}</Button>
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>O modelo "{toDelete?.titulo}" será removido. Documentos já emitidos com ele não são afetados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={excluir} data-testid="confirmar-excluir-modelo">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
