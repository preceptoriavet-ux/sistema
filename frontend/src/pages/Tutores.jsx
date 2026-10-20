import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, Phone, PawPrint } from "lucide-react";

const EMPTY = { nome: "", cpf: "", telefone: "", telefone2: "", whatsapp: "", email: "", endereco: "", cidade: "", contato_emergencia: "", observacoes: "", situacao: "ativo" };

export default function Tutores() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query = "") => {
    const { data } = await api.get("/tutores", { params: query ? { q: query } : {} });
    setRows(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(q), 350); return () => clearTimeout(t); }, [q, load]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (t) => { setForm({ ...EMPTY, ...t }); setEditId(t.id); setOpen(true); };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome do tutor");
    setSaving(true);
    try {
      if (editId) { await api.put(`/tutores/${editId}`, form); toast.success("Tutor atualizado"); }
      else { await api.post("/tutores", form); toast.success("Tutor cadastrado"); }
      setOpen(false); load(q);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const remove = async (t) => {
    if (!window.confirm(`Excluir o tutor ${t.nome}?`)) return;
    try { await api.delete(`/tutores/${t.id}`); toast.success("Tutor excluído"); load(q); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Tutores</h1>
          <p className="text-sm text-muted-foreground">{rows.length} cadastrado(s)</p>
        </div>
        {can("tutores:write") && <Button onClick={openNew} data-testid="novo-tutor-button"><Plus className="h-4 w-4 mr-1.5" />Novo Tutor</Button>}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nº de cadastro, nome, CPF ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="tutor-search-input" />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">CPF</TableHead>
              <TableHead className="hidden sm:table-cell">Contato</TableHead>
              <TableHead>Pets</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} className="hover:bg-slate-50/80" data-testid={`tutor-row-${t.id}`}>
                <TableCell className="font-mono text-sm font-semibold text-primary" data-testid={`tutor-codigo-${t.id}`}>{t.codigo ?? "—"}</TableCell>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs">{t.cpf || "—"}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm"><span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{t.telefone || "—"}</span></TableCell>
                <TableCell><span className="inline-flex items-center gap-1 text-sm"><PawPrint className="h-3.5 w-3.5 text-primary" />{t.num_pacientes}</span></TableCell>
                <TableCell><Badge variant="outline" className={t.situacao === "ativo" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-gray-100 text-gray-600"}>{t.situacao}</Badge></TableCell>
                <TableCell className="text-right">
                  {can("tutores:write") && <>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} data-testid={`edit-tutor-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)} data-testid={`delete-tutor-${t.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum tutor encontrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{editId ? "Editar Tutor" : "Novo Tutor"}
            <Badge variant="outline" className="font-mono" data-testid="tutor-codigo-ficha">{editId ? `Nº ${form.codigo ?? "—"}` : "Nº gerado ao salvar"}</Badge></DialogTitle></DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dados do Tutor</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => field("nome", e.target.value)} data-testid="tutor-nome-input" /></div>
            <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => field("cpf", e.target.value)} /></div>
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => field("cidade", e.target.value)} /></div>
            <div><Label>Telefone principal</Label><Input value={form.telefone} onChange={(e) => field("telefone", e.target.value)} /></div>
            <div><Label>Telefone secundário</Label><Input value={form.telefone2} onChange={(e) => field("telefone2", e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => field("whatsapp", e.target.value)} /></div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => field("email", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Endereço completo</Label><Input value={form.endereco} onChange={(e) => field("endereco", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Contato para emergências</Label><Input value={form.contato_emergencia} onChange={(e) => field("contato_emergencia", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Observações administrativas</Label><Textarea value={form.observacoes} onChange={(e) => field("observacoes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-tutor-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
