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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, Wallet, Clock, CheckCircle2, Pencil } from "lucide-react";

const iso = (d) => d.toISOString().slice(0, 10);
const brl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (s) => (s ? s.split("-").reverse().join("/") : "—");
const FORMAS = ["Dinheiro", "Pix", "Cartão de Débito", "Cartão de Crédito", "Transferência", "Boleto"];
const ST = {
  pendente: { l: "Pendente", c: "bg-amber-100 text-amber-800 border-amber-300" },
  pago: { l: "Pago", c: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelado: { l: "Cancelado", c: "bg-gray-100 text-gray-600 border-gray-300" },
};
const L_EMPTY = { tipo: "receita", categoria: "", descricao: "", valor: "", desconto: "", status: "pendente", forma_pagamento: "", data: iso(new Date()), vencimento: "", paciente_nome: "", observacoes: "" };
const S_EMPTY = { nome: "", categoria: "", preco: "", descricao: "", ativo: true };

function Kpi({ icon: Icon, label, value, tint, testid }) {
  return (
    <Card className="p-5" data-testid={testid}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Icon className="h-4 w-4" />{label}</div>
      <p className="text-2xl font-heading font-extrabold font-mono">{value}</p>
    </Card>
  );
}

export default function Financeiro() {
  const { can } = useAuth();
  const [ini, setIni] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [fim, setFim] = useState(iso(new Date()));
  const [resumo, setResumo] = useState(null);
  const [lancs, setLancs] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [fTipo, setFTipo] = useState("todos");

  const [lOpen, setLOpen] = useState(false);
  const [lForm, setLForm] = useState(L_EMPTY);
  const [lEdit, setLEdit] = useState(null);
  const [sOpen, setSOpen] = useState(false);
  const [sForm, setSForm] = useState(S_EMPTY);
  const [sEdit, setSEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadResumo = useCallback(async () => {
    const { data } = await api.get("/financeiro/resumo", { params: { data_ini: ini, data_fim: fim } });
    setResumo(data);
  }, [ini, fim]);
  const loadLancs = useCallback(async () => {
    const params = { data_ini: ini, data_fim: fim };
    if (fTipo !== "todos") params.tipo = fTipo;
    const { data } = await api.get("/financeiro", { params });
    setLancs(data);
  }, [ini, fim, fTipo]);
  const loadServicos = useCallback(async () => { const { data } = await api.get("/servicos"); setServicos(data); }, []);

  useEffect(() => { loadResumo(); loadLancs(); loadServicos(); }, [loadResumo, loadLancs, loadServicos]);

  const lf = (k, v) => setLForm((f) => ({ ...f, [k]: v }));
  const sf = (k, v) => setSForm((f) => ({ ...f, [k]: v }));
  const openLanc = (tipo) => { setLForm({ ...L_EMPTY, tipo }); setLEdit(null); setLOpen(true); };
  const editLanc = (l) => { setLForm({ ...L_EMPTY, ...l, valor: String(l.valor ?? ""), desconto: String(l.desconto ?? "") }); setLEdit(l.id); setLOpen(true); };

  const saveLanc = async () => {
    if (!lForm.descricao.trim()) return toast.error("Informe a descrição");
    setSaving(true);
    try {
      if (lEdit) await api.put(`/financeiro/${lEdit}`, lForm);
      else await api.post("/financeiro", lForm);
      toast.success("Lançamento salvo"); setLOpen(false); loadResumo(); loadLancs();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  const marcarPago = async (l) => { try { await api.put(`/financeiro/${l.id}`, { status: "pago" }); toast.success("Marcado como pago"); loadResumo(); loadLancs(); } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } };

  const openServico = () => { setSForm(S_EMPTY); setSEdit(null); setSOpen(true); };
  const editServico = (s) => { setSForm({ ...S_EMPTY, ...s, preco: String(s.preco ?? "") }); setSEdit(s.id); setSOpen(true); };
  const saveServico = async () => {
    if (!sForm.nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      if (sEdit) await api.put(`/servicos/${sEdit}`, sForm);
      else await api.post("/servicos", sForm);
      toast.success("Serviço salvo"); setSOpen(false); loadServicos();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const readOnly = !can("financeiro:write");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-bold tracking-tight">Financeiro & Faturamento</h1><p className="text-sm text-muted-foreground">Período: {brDate(ini)} a {brDate(fim)}</p></div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-40" data-testid="fin-data-ini" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" data-testid="fin-data-fim" /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={TrendingUp} label="Recebido" value={brl(resumo?.recebido)} testid="fin-kpi-recebido" />
        <Kpi icon={Clock} label="A Receber" value={brl(resumo?.a_receber)} testid="fin-kpi-areceber" />
        <Kpi icon={TrendingDown} label="Despesas Pagas" value={brl(resumo?.despesas)} testid="fin-kpi-despesas" />
        <Kpi icon={Clock} label="A Pagar" value={brl(resumo?.a_pagar)} testid="fin-kpi-apagar" />
        <Kpi icon={Wallet} label="Saldo" value={brl(resumo?.saldo)} testid="fin-kpi-saldo" />
      </div>

      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos" data-testid="tab-lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="servicos" data-testid="tab-servicos">Serviços & Preços</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="pt-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-44" data-testid="fin-filtro-tipo"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="receita">Receitas</SelectItem><SelectItem value="despesa">Despesas</SelectItem></SelectContent>
            </Select>
            {!readOnly && <div className="flex gap-2">
              <Button variant="outline" onClick={() => openLanc("despesa")} data-testid="nova-despesa-button"><Plus className="h-4 w-4 mr-1.5" />Despesa</Button>
              <Button onClick={() => openLanc("receita")} data-testid="nova-receita-button"><Plus className="h-4 w-4 mr-1.5" />Receita</Button>
            </div>}
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead className="hidden md:table-cell">Data</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {lancs.map((l) => {
                  const st = ST[l.status] || ST.pendente;
                  return (
                    <TableRow key={l.id} data-testid={`lanc-row-${l.id}`}>
                      <TableCell className="font-medium">{l.descricao}{l.paciente_nome && <span className="block text-[11px] text-muted-foreground">{l.paciente_nome}</span>}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{brDate(l.data)}</TableCell>
                      <TableCell><Badge variant="outline" className={l.tipo === "receita" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>{l.tipo}</Badge></TableCell>
                      <TableCell className={`text-right font-mono ${l.tipo === "receita" ? "text-emerald-700" : "text-rose-700"}`}>{l.tipo === "despesa" ? "- " : ""}{brl(l.valor - (l.desconto || 0))}</TableCell>
                      <TableCell><Badge variant="outline" className={st.c}>{st.l}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {!readOnly && l.status === "pendente" && <Button variant="ghost" size="icon" title="Marcar pago" onClick={() => marcarPago(l)} data-testid={`pagar-${l.id}`}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>}
                        {!readOnly && <Button variant="ghost" size="icon" onClick={() => editLanc(l)} data-testid={`edit-lanc-${l.id}`}><Pencil className="h-4 w-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {lancs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum lançamento no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="servicos" className="pt-2 space-y-3">
          {!readOnly && <div className="flex justify-end"><Button onClick={openServico} data-testid="novo-servico-button"><Plus className="h-4 w-4 mr-1.5" />Novo Serviço</Button></div>}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Serviço</TableHead><TableHead className="hidden sm:table-cell">Categoria</TableHead><TableHead className="text-right">Preço</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {servicos.map((s) => (
                  <TableRow key={s.id} data-testid={`servico-row-${s.id}`}>
                    <TableCell className="font-medium">{s.nome}{s.descricao && <span className="block text-[11px] text-muted-foreground">{s.descricao}</span>}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{s.categoria || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{brl(s.preco)}</TableCell>
                    <TableCell><Badge variant="outline" className={s.ativo ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-gray-100 text-gray-600"}>{s.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">{!readOnly && <Button variant="ghost" size="icon" onClick={() => editServico(s)} data-testid={`edit-servico-${s.id}`}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
                {servicos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum serviço cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={lOpen} onOpenChange={setLOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lEdit ? "Editar Lançamento" : lForm.tipo === "receita" ? "Nova Receita" : "Nova Despesa"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Descrição *</Label><Input value={lForm.descricao} onChange={(e) => lf("descricao", e.target.value)} data-testid="lanc-descricao-input" /></div>
            <div><Label>Categoria</Label><Input value={lForm.categoria} onChange={(e) => lf("categoria", e.target.value)} placeholder="Consulta, Exame, Compra..." /></div>
            <div><Label>Serviço (preço)</Label>
              <Select value={lForm.servico_id || ""} onValueChange={(v) => { const s = servicos.find((x) => x.id === v); setLForm((f) => ({ ...f, servico_id: v, descricao: f.descricao || (s?.nome || ""), valor: String(s?.preco ?? f.valor) })); }}>
                <SelectTrigger data-testid="lanc-servico-select"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{servicos.filter((s) => s.ativo).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome} — {brl(s.preco)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={lForm.valor} onChange={(e) => lf("valor", e.target.value)} data-testid="lanc-valor-input" /></div>
            <div><Label>Desconto (R$)</Label><Input type="number" step="0.01" value={lForm.desconto} onChange={(e) => lf("desconto", e.target.value)} /></div>
            <div><Label>Data</Label><Input type="date" value={lForm.data} onChange={(e) => lf("data", e.target.value)} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={lForm.vencimento} onChange={(e) => lf("vencimento", e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={lForm.status} onValueChange={(v) => lf("status", v)}>
                <SelectTrigger data-testid="lanc-status-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Forma de pagamento</Label>
              <Select value={lForm.forma_pagamento || ""} onValueChange={(v) => lf("forma_pagamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Tutor / Paciente (opcional)</Label><Input value={lForm.paciente_nome} onChange={(e) => lf("paciente_nome", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Textarea rows={2} value={lForm.observacoes} onChange={(e) => lf("observacoes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLOpen(false)}>Cancelar</Button>
            <Button onClick={saveLanc} disabled={saving} data-testid="save-lanc-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sOpen} onOpenChange={setSOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{sEdit ? "Editar Serviço" : "Novo Serviço"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Nome *</Label><Input value={sForm.nome} onChange={(e) => sf("nome", e.target.value)} data-testid="servico-nome-input" /></div>
            <div><Label>Categoria</Label><Input value={sForm.categoria} onChange={(e) => sf("categoria", e.target.value)} /></div>
            <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={sForm.preco} onChange={(e) => sf("preco", e.target.value)} data-testid="servico-preco-input" /></div>
            <div className="sm:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={sForm.descricao} onChange={(e) => sf("descricao", e.target.value)} /></div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3"><Label>Serviço ativo</Label><Switch checked={sForm.ativo} onCheckedChange={(v) => sf("ativo", v)} data-testid="servico-ativo-switch" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSOpen(false)}>Cancelar</Button>
            <Button onClick={saveServico} disabled={saving} data-testid="save-servico-button">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
