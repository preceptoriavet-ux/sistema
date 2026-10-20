import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Section = ({ children }) => <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</p>;

export const TriagemFicha = ({ form, field }) => {
  const inp = (k, label, props = {}) => (
    <div className={props.className}><Label>{label}</Label><Input value={form[k] || ""} onChange={(e) => field(k, e.target.value)} placeholder={props.placeholder} data-testid={`triagem-${k}-input`} /></div>
  );
  const txt = (k, label, props = {}) => (
    <div className="sm:col-span-2"><Label>{label}</Label><Textarea rows={2} value={form[k] || ""} onChange={(e) => field(k, e.target.value)} placeholder={props.placeholder} data-testid={`triagem-${k}-input`} /></div>
  );
  return (
    <div className="space-y-3" data-testid="triagem-ficha">
      <Section>Queixa</Section>
      <div className="grid sm:grid-cols-2 gap-3">
        {inp("queixa_principal", "Queixa principal", { className: "sm:col-span-2" })}
        {inp("inicio_sinais", "Início dos sinais", { placeholder: "ex: há 2 dias" })}
        <div><Label>Prioridade</Label>
          <Select value={form.prioridade || "normal"} onValueChange={(v) => field("prioridade", v)}>
            <SelectTrigger data-testid="triagem-prioridade-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="urgente">Urgente</SelectItem><SelectItem value="emergencia">Emergência</SelectItem></SelectContent>
          </Select>
        </div>
        {txt("historico", "Histórico resumido")}
      </div>
      <Section>Sinais Vitais</Section>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {inp("temperatura", "Temp (°C)")}{inp("fc", "FC")}{inp("fr", "FR")}{inp("peso", "Peso (kg)")}{inp("dor", "Dor (0-10)")}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {inp("hidratacao", "Hidratação")}{inp("info_tutor", "Informações do tutor")}
        {txt("sinais_alerta", "Sinais de alerta", { placeholder: "Deixe em branco se não houver" })}
        {txt("observacoes", "Observações")}
      </div>
    </div>
  );
};
