import { useRef } from "react";
import { TIPOS_DOCUMENTO } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VariaveisChips, inserirNoCursor } from "./Variaveis";

export const DOC_VAZIO = { tipo: "receita", modelo_id: "", titulo: "", medicamentos: "", corpo: "" };

export const docSelectValue = (f) => (f.tipo === "modelo" ? `modelo:${f.modelo_id}` : f.tipo);

export const EmitirDocumentoCampos = ({ form, setForm, modelos, prefix = "documento" }) => {
  const corpoRef = useRef(null);
  const cfg = TIPOS_DOCUMENTO.find((t) => t.value === form.tipo);
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const escolher = (v) => {
    if (v.startsWith("modelo:")) {
      const m = modelos.find((x) => x.id === v.slice(7));
      setForm((f) => ({ ...f, tipo: "modelo", modelo_id: m.id, titulo: m.titulo, corpo: m.conteudo, medicamentos: "" }));
    } else setForm((f) => ({ ...f, tipo: v, modelo_id: "", titulo: "", corpo: f.tipo === "modelo" ? "" : f.corpo }));
  };
  return (
    <>
      <div><Label>Tipo de documento / modelo</Label>
        <Select value={docSelectValue(form)} onValueChange={escolher}>
          <SelectTrigger data-testid={`${prefix}-tipo-select`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup><SelectLabel>Tipos padrão</SelectLabel>
              {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectGroup>
            {modelos.length > 0 && <><SelectSeparator /><SelectGroup><SelectLabel>Modelos da clínica</SelectLabel>
              {modelos.map((m) => <SelectItem key={m.id} value={`modelo:${m.id}`} data-testid={`${prefix}-modelo-opcao-${m.id}`}>{m.titulo}</SelectItem>)}
            </SelectGroup></>}
          </SelectContent>
        </Select>
      </div>
      {form.tipo === "modelo" && (
        <div><Label>Título do documento</Label><Input value={form.titulo} onChange={(e) => field("titulo", e.target.value)} data-testid={`${prefix}-titulo-input`} /></div>
      )}
      {cfg?.medicamentos && (
        <div><Label>Medicamentos / Prescrição</Label>
          <Textarea rows={5} value={form.medicamentos} onChange={(e) => field("medicamentos", e.target.value)} data-testid={`${prefix}-medicamentos-input`}
            placeholder={"1) Amoxicilina 250mg — 1 comp. VO a cada 12h por 7 dias\n2) ..."} />
        </div>
      )}
      <div className="space-y-1.5"><Label>{cfg?.medicamentos ? "Orientações" : "Conteúdo"}</Label>
        <Textarea ref={corpoRef} rows={form.tipo === "modelo" ? 10 : 6} value={form.corpo} onChange={(e) => field("corpo", e.target.value)} data-testid={`${prefix}-corpo-input`} placeholder="Digite o texto do documento…" />
        <VariaveisChips onInsert={(v) => inserirNoCursor(corpoRef, form.corpo, (val) => field("corpo", val), v)} />
        <p className="text-[11px] text-muted-foreground">As variáveis são preenchidas automaticamente com os dados do paciente ao gerar o PDF.</p>
      </div>
    </>
  );
};
