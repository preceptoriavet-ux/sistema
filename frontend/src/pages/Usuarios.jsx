import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, ShieldCheck, Building2 } from "lucide-react";

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [audit, setAudit] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "recepcionista", conselho: "", active: true });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clinica, setClinica] = useState({ nome: "", endereco: "", telefone: "", cnpj: "", email: "" });
  const [savingClinica, setSavingClinica] = useState(false);

  const load = useCallback(async () => {
    const [u, r, a, c] = await Promise.all([api.get("/users"), api.get("/users/roles"), api.get("/audit"), api.get("/config/clinica")]);
    setUsers(u.data); setRoles(r.data); setAudit(a.data); setClinica(c.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cfield = (k, v) => setClinica((c) => ({ ...c, [k]: v }));
  const saveClinica = async () => {
    if (!clinica.nome.trim()) return toast.error("Informe o nome da clínica");
    setSavingClinica(true);
    try { await api.put("/config/clinica", clinica); toast.success("Dados da clínica atualizados"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSavingClinica(false); }
  };

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setForm({ name: "", email: "", password: "", role: "recepcionista", conselho: "", active: true }); setEditId(null); setOpen(true); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: "", role: u.role, conselho: u.conselho || "", active: u.active }); setEditId(u.id); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      if (editId) { const p = { name: form.name, role: form.role, active: form.active, conselho: form.conselho }; if (form.password) p.password = form.password; await api.put(`/users/${editId}`, p); toast.success("Usuário atualizado"); }
      else { if (!form.email || !form.password) { setSaving(false); return toast.error("E-mail e senha obrigatórios"); } await api.post("/users", form); toast.success("Usuário criado"); }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const roleLabel = (v) => roles.find((r) => r.value === v)?.label || v;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Usuários & Permissões</h1><p className="text-sm text-muted-foreground">{users.length} usuário(s)</p></div>
        <Button onClick={openNew} data-testid="novo-usuario-button"><Plus className="h-4 w-4 mr-1.5" />Novo Usuário</Button>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" data-testid="tab-usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="permissoes">Funções & Permissões</TabsTrigger>
          <TabsTrigger value="clinica" data-testid="tab-clinica">Dados da Clínica</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="pt-2">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="hidden sm:table-cell">E-mail</TableHead><TableHead>Função</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-testid={`usuario-row-${u.id}`}>
                    <TableCell className="font-medium">{u.name}{u.conselho && <span className="block text-[11px] text-muted-foreground font-mono">{u.conselho}</span>}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{u.role_label}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={u.active ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-rose-100 text-rose-800 border-rose-300"}>{u.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(u)} data-testid={`edit-usuario-${u.id}`}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes" className="pt-2">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => (
              <Card key={r.value} className="p-4">
                <p className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{r.label}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.permissions.length ? r.permissions.map((p) => <Badge key={p} variant="outline" className="text-[10px] font-mono">{p}</Badge>) : <span className="text-xs text-muted-foreground">Sem permissões</span>}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auditoria" className="pt-2">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead className="hidden sm:table-cell">Detalhes</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{new Date(a.at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{a.user_name}</TableCell>
                    <TableCell className="text-sm">{a.action} <span className="text-muted-foreground">{a.entity}</span></TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{a.details}</TableCell>
                  </TableRow>
                ))}
                {audit.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem registros.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="clinica" className="pt-2">
          <Card className="p-5 max-w-xl">
            <p className="font-semibold flex items-center gap-2 mb-4"><Building2 className="h-4 w-4 text-primary" />Dados da Clínica <span className="text-xs font-normal text-muted-foreground">(aparecem nos PDFs)</span></p>
            <div className="grid gap-3">
              <div><Label>Nome da clínica *</Label><Input value={clinica.nome || ""} onChange={(e) => cfield("nome", e.target.value)} data-testid="clinica-nome-input" /></div>
              <div><Label>Endereço</Label><Input value={clinica.endereco || ""} onChange={(e) => cfield("endereco", e.target.value)} data-testid="clinica-endereco-input" /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Telefone</Label><Input value={clinica.telefone || ""} onChange={(e) => cfield("telefone", e.target.value)} data-testid="clinica-telefone-input" /></div>
                <div><Label>CNPJ</Label><Input value={clinica.cnpj || ""} onChange={(e) => cfield("cnpj", e.target.value)} data-testid="clinica-cnpj-input" /></div>
              </div>
              <div><Label>E-mail</Label><Input value={clinica.email || ""} onChange={(e) => cfield("email", e.target.value)} /></div>
              <div><Button onClick={saveClinica} disabled={savingClinica} data-testid="save-clinica-button">{savingClinica ? "Salvando…" : "Salvar Dados"}</Button></div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome completo *</Label><Input value={form.name} onChange={(e) => field("name", e.target.value)} data-testid="usuario-nome-input" /></div>
            <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} disabled={!!editId} data-testid="usuario-email-input" /></div>
            <div><Label>{editId ? "Nova senha (opcional)" : "Senha *"}</Label><Input type="password" value={form.password} onChange={(e) => field("password", e.target.value)} data-testid="usuario-senha-input" /></div>
            <div><Label>Função *</Label>
              <Select value={form.role} onValueChange={(v) => field("role", v)}>
                <SelectTrigger data-testid="usuario-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Registro profissional (CRMV)</Label><Input value={form.conselho} onChange={(e) => field("conselho", e.target.value)} placeholder="opcional" /></div>
            {editId && <div className="flex items-center justify-between rounded-lg border p-3"><Label>Usuário ativo</Label><Switch checked={form.active} onCheckedChange={(v) => field("active", v)} data-testid="usuario-active-switch" /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-usuario-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
