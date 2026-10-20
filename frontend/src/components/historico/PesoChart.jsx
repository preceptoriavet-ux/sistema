import { Card } from "@/components/ui/card";
import { Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const fmtDia = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

const Dica = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{p.peso} kg</p>
      <p className="text-muted-foreground">{fmtDia(p.data_local)}{p.data_local.length > 10 && ` ${p.data_local.slice(11, 16)}`} · {p.fonte}</p>
    </div>
  );
};

export const PesoChart = ({ pesos }) => {
  if (!pesos?.length) return <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3" data-testid="peso-chart-vazio">Nenhum peso registrado em prontuários, triagens ou no cadastro.</p>;
  const ultimo = pesos[pesos.length - 1].peso;
  const dif = +(ultimo - pesos[0].peso).toFixed(2);
  const pct = pesos[0].peso ? ((dif / pesos[0].peso) * 100).toFixed(1) : "0";
  const Trend = dif > 0 ? TrendingUp : dif < 0 ? TrendingDown : Minus;
  const data = pesos.map((p, i) => ({ ...p, idx: i, label: fmtDia(p.data_local) }));
  return (
    <Card className="p-5 space-y-3" data-testid="peso-chart">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Scale className="h-3.5 w-3.5" />Evolução do Peso</p>
          <p className="font-heading text-3xl font-bold tracking-tight" data-testid="peso-ultimo">{ultimo} <span className="text-base font-medium text-muted-foreground">kg</span></p>
        </div>
        {pesos.length > 1 && (
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${dif > 0 ? "bg-amber-100 text-amber-800" : dif < 0 ? "bg-sky-100 text-sky-800" : "bg-secondary text-muted-foreground"}`} data-testid="peso-variacao">
            <Trend className="h-3.5 w-3.5" />{dif > 0 ? "+" : ""}{dif} kg ({dif > 0 ? "+" : ""}{pct}%) desde {fmtDia(pesos[0].data_local)}
          </div>
        )}
        <p className="w-full text-[11px] text-muted-foreground sm:w-auto">{pesos.length} medição(ões) · prontuários, triagens e cadastro</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="idx" tickFormatter={(i) => data[i]?.label} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit=" kg" width={64} allowDecimals />
            <Tooltip content={<Dica />} />
            <Line type="monotone" dataKey="peso" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
