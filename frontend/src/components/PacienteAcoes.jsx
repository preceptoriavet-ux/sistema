import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Trash2, Archive, ArchiveRestore, AlertTriangle } from "lucide-react";

export const PacienteAcoes = ({ paciente, onDone }) => {
  const [confirm, setConfirm] = useState(false);
  const [bloqueio, setBloqueio] = useState("");
  const [busy, setBusy] = useState(false);
  const inativo = paciente.ativo === false;

  const alternar = async () => {
    setBusy(true);
    try {
      await api.put(`/pacientes/${paciente.id}/ativo`, { ativo: inativo });
      toast.success(inativo ? "Paciente reativado" : "Paciente inativado — histórico preservado");
      setConfirm(false); onDone();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const excluir = async () => {
    setBusy(true);
    try { await api.delete(`/pacientes/${paciente.id}`); toast.success("Paciente excluído"); setConfirm(false); onDone(); }
    catch (e) {
      if (e.response?.status === 409) setBloqueio(e.response.data.detail);
      else toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <div className="mr-auto flex gap-2">
      <Button variant="outline" onClick={alternar} disabled={busy} data-testid={inativo ? "reativar-paciente-button" : "inativar-paciente-button"}>
        {inativo ? <><ArchiveRestore className="h-4 w-4 mr-1.5" />Reativar</> : <><Archive className="h-4 w-4 mr-1.5" />Inativar</>}
      </Button>
      <Button variant="outline" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => { setBloqueio(""); setConfirm(true); }} data-testid="excluir-paciente-button"><Trash2 className="h-4 w-4 mr-1.5" />Excluir</Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bloqueio ? "Exclusão bloqueada" : `Excluir ${paciente.nome}?`}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {bloqueio ? (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900" data-testid="exclusao-bloqueada-msg"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{bloqueio}</span></div>
              ) : <p>Esta ação é permanente. Pacientes com prontuários, exames, documentos, triagens ou vacinas não podem ser excluídos.</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancelar-excluir-paciente">Cancelar</AlertDialogCancel>
            {bloqueio
              ? !inativo && <Button onClick={alternar} disabled={busy} data-testid="inativar-no-bloqueio-button"><Archive className="h-4 w-4 mr-1.5" />Inativar paciente</Button>
              : <Button className="bg-rose-600 hover:bg-rose-700" onClick={excluir} disabled={busy} data-testid="confirmar-excluir-paciente">Excluir</Button>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
