import { Button } from "@/components/ui/button";

export const VARIAVEIS = ["{paciente}", "{nº paciente}", "{espécie}", "{raça}", "{tutor}", "{data}", "{veterinário}"];

export const VariaveisChips = ({ onInsert }) => (
  <div className="flex flex-wrap items-center gap-1.5" data-testid="variaveis-chips">
    <span className="text-[11px] text-muted-foreground">Inserir variável:</span>
    {VARIAVEIS.map((v) => (
      <Button key={v} type="button" size="sm" variant="outline" className="h-6 px-2 font-mono text-[11px]" onClick={() => onInsert(v)} data-testid={`variavel-${v.replace(/[{}\s]/g, "")}`}>{v}</Button>
    ))}
  </div>
);

export const inserirNoCursor = (ref, valor, setValor, texto) => {
  const el = ref.current;
  if (!el) return setValor((valor || "") + texto);
  const ini = el.selectionStart ?? valor.length;
  const fim = el.selectionEnd ?? valor.length;
  setValor(valor.slice(0, ini) + texto + valor.slice(fim));
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + texto.length, ini + texto.length); });
};
