import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { filaStatus, especieLabel } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, PawPrint, ClipboardList, CalendarDays, Clock, Stethoscope, AlertTriangle } from "lucide-react";

function Kpi({ icon: Icon, label, value, testid, tint }) {
  return (
    <Card className="p-5 flex items-center gap-4" data-testid={testid}>
      <div className={`grid place-items-center h-12 w-12 rounded-xl ${tint}`}><Icon className="h-6 w-6" /></div>
      <div>
        <p className="text-2xl font-heading font-extrabold leading-none font-mono">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight">Olá, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">Resumo da clínica — {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={ClipboardList} label="Na fila agora" value={data?.fila_ativa} testid="kpi-fila-card" tint="bg-amber-100 text-amber-700" />
        <Kpi icon={CalendarDays} label="Agendados hoje" value={data?.agendamentos_hoje} testid="kpi-agenda-card" tint="bg-sky-100 text-sky-700" />
        <Kpi icon={Users} label="Tutores" value={data?.total_tutores} testid="kpi-tutores-card" tint="bg-emerald-100 text-emerald-700" />
        <Kpi icon={PawPrint} label="Pacientes" value={data?.total_pacientes} testid="kpi-pacientes-card" tint="bg-violet-100 text-violet-700" />
      </div>

      {data?.emergencias?.length > 0 && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 animate-fade-up" data-testid="emergency-alert">
          <div className="flex items-center gap-2 text-rose-800 font-semibold mb-2">
            <AlertTriangle className="h-5 w-5" /> {data.emergencias.length} emergência(s) na triagem hoje
          </div>
          <div className="flex flex-wrap gap-2">
            {data.emergencias.map((e) => (
              <div key={e.id} className="rounded-lg bg-white border border-rose-200 px-3 py-1.5 text-sm" data-testid={`emergency-${e.id}`}>
                <span className="font-medium">{e.paciente_nome}</span>
                <span className="text-muted-foreground"> · {e.queixa_principal || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold">Fila de Atendimento</h2>
            <button onClick={() => navigate("/recepcao")} className="text-sm text-primary font-medium" data-testid="dashboard-ver-fila">Ver tudo</button>
          </div>
          {data?.fila?.length ? (
            <div className="space-y-2">
              {data.fila.slice(0, 7).map((f) => {
                const st = filaStatus(f.status);
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="text-xl">{especieLabel(f.especie).icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.paciente_nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.tutor_nome}</p>
                    </div>
                    {f.prioridade === "emergencia" && <Badge className="bg-rose-100 text-rose-800 border-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Emergência</Badge>}
                    <Badge variant="outline" className={st.color}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground py-8 text-center">Nenhum paciente na fila.</p>}
        </Card>

        <Card className="p-5">
          <h2 className="font-heading text-lg font-bold mb-4">Agenda de Hoje</h2>
          {data?.agenda_hoje?.length ? (
            <div className="space-y-2">
              {data.agenda_hoje.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="flex items-center gap-1 text-xs font-mono text-primary font-semibold w-14 shrink-0">
                    <Clock className="h-3 w-3" />{a.inicio?.slice(11, 16)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.paciente_nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.tipo} · {a.profissional_nome || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem agendamentos hoje.</p>}
          {data?.prontuarios_revisao > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <Stethoscope className="h-4 w-4" /> {data.prontuarios_revisao} prontuário(s) aguardando revisão
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
