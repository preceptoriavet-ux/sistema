import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { especieLabel, suggestProximaDose } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Syringe, AlertTriangle, Sparkles } from "lucide-react";

const TIPO = { vacina: "Vacina", vermifugo: "Vermífugo", ectoparasita: "Ectoparasita" };
const EMPTY = { paciente_id: "", tipo: "vacina", nome: "", fabricante: "", lote: "", validade: "", data_aplicacao: new Date().toISOString().slice(0, 10), dose: "", via: "", proxima_dose: "", reacoes: "", observacoes: "" };

export default function Vacinas() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [v, p] = await Promise.all([api.get("/vacinas"), api.get("/vacinas/pendentes")]);
    setRows(v.data); setPendentes(p.data);
  }, []);
  useEffect(() => { load(); api.get("/pacientes").then((r) => setPacientes(r.data)); }, [load]);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setForm(EMPTY); setOpen(true); };

  const especieSel = pacientes.find((p) => p.id === form.paciente_id)?.especie || "";
  const sugestao = suggestProximaDose(especieSel, form.nome, form.data_aplicacao);
  useEffect(() => {
    if (open && sugestao && !form.proxima_dose) setForm((f) => ({ ...f, proxima_dose: sugestao }));
  }, [open, sugestao]); // eslint-disable-line

  const save = async () => {
    if (!form.paciente_id) return toast.error("Selecione o paciente");
    if (!form.nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try { await api.post("/vacinas", form); toast.success("Registro salvo"); setOpen(false); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Vacinação & Medicina Preventiva</h1><p className="text-sm text-muted-foreground">{rows.length} registro(s) · {pendentes.length} pendência(s)</p></div>
        {can("vacina:write") && <Button onClick={openNew} data-testid="nova-vacina-button"><Plus className="h-4 w-4 mr-1.5" />Novo Registro</Button>}
      </div>

      <Tabs defaultValue="carteira">
        <TabsList>
          <TabsTrigger value="carteira" data-testid="tab-carteira">Carteira / Histórico</TabsTrigger>
          <TabsTrigger value="pendentes" data-testid="tab-pendentes">Pendentes ({pendentes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="pt-2">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Paciente</TableHead><TableHead>Tipo / Produto</TableHead><TableHead className="hidden sm:table-cell">Lote</TableHead><TableHead>Aplicação</TableHead><TableHead>Próxima</TableHead><TableHead>Resp.</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <TableRow key={v.id} data-testid={`vacina-row-${v.id}`}>
                    <TableCell className="text-sm font-medium">{especieLabel(v.especie).icon} {v.paciente_nome}</TableCell>
                    <TableCell className="text-sm"><Badge variant="outline" className="mr-1.5 text-[10px]">{TIPO[v.tipo] || v.tipo}</Badge>{v.nome}</TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">{v.lote || "—"}</TableCell>
                    <TableCell className="text-sm">{v.data_aplicacao || "—"}</TableCell>
                    <TableCell className="text-sm">{v.proxima_dose ? <Badge variant="outline" className={v.proxima_dose <= today ? "bg-rose-100 text-rose-800 border-rose-300" : ""}>{v.proxima_dose}</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.responsavel}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pendentes" className="pt-2">
          <div className="grid gap-3">
            {pendentes.map((v) => (
              <Card key={v.id} className="p-4 flex items-center gap-3" data-testid={`pendente-${v.id}`}>
                <div className="grid place-items-center h-10 w-10 rounded-lg bg-amber-100 text-amber-700 shrink-0"><Syringe className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{v.paciente_nome} · {v.nome}</p>
                  <p className="text-xs text-muted-foreground">{TIPO[v.tipo] || v.tipo} · próxima dose: {v.proxima_dose}</p>
                </div>
                {v.proxima_dose <= today && <Badge className="bg-rose-100 text-rose-800 border-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Vencida</Badge>}
              </Card>
            ))}
            {pendentes.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma pendência nos próximos 30 dias.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Registro Preventivo</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => field("paciente_id", v)}>
                <SelectTrigger data-testid="vacina-paciente-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.tutor_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => field("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="vacina">Vacina</SelectItem><SelectItem value="vermifugo">Vermífugo</SelectItem><SelectItem value="ectoparasita">Ectoparasita</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Nome do produto *</Label><Input value={form.nome} onChange={(e) => field("nome", e.target.value)} data-testid="vacina-nome-input" /></div>
            <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={(e) => field("fabricante", e.target.value)} /></div>
            <div><Label>Lote</Label><Input value={form.lote} onChange={(e) => field("lote", e.target.value)} /></div>
            <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={(e) => field("validade", e.target.value)} /></div>
            <div><Label>Data de aplicação</Label><Input type="date" value={form.data_aplicacao} onChange={(e) => field("data_aplicacao", e.target.value)} data-testid="vacina-data-input" /></div>
            <div><Label>Dose</Label><Input value={form.dose} onChange={(e) => field("dose", e.target.value)} /></div>
            <div><Label>Via</Label><Input value={form.via} onChange={(e) => field("via", e.target.value)} placeholder="SC, IM..." /></div>
            <div><Label>Próxima dose</Label><Input type="date" value={form.proxima_dose} onChange={(e) => field("proxima_dose", e.target.value)} data-testid="vacina-proxima-input" />
              {sugestao && (
                <button type="button" onClick={() => field("proxima_dose", sugestao)} className="mt-1 inline-flex items-center gap-1 text-xs text-primary" data-testid="vacina-sugestao-btn">
                  <Sparkles className="h-3 w-3" />Sugerido pelo protocolo: {sugestao.split("-").reverse().join("/")}
                </button>
              )}
            </div>
            <div className="sm:col-span-2"><Label>Reações adversas</Label><Textarea rows={2} value={form.reacoes} onChange={(e) => field("reacoes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="save-vacina-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
