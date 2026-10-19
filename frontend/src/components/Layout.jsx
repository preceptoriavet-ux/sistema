import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, PawPrint, CalendarDays, ClipboardList, Stethoscope,
  ShieldCheck, LogOut, Menu, X, PlusCircle, Activity, Syringe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Painel Geral", icon: LayoutDashboard, perm: null, testid: "dashboard" },
  { to: "/recepcao", label: "Fila de Atendimento", icon: ClipboardList, perm: "fila:read", testid: "recepcao" },
  { to: "/triagem", label: "Triagem", icon: Activity, perm: "triagem:read", testid: "triagem" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, perm: "agenda:read", testid: "agenda" },
  { to: "/tutores", label: "Tutores", icon: Users, perm: "tutores:read", testid: "tutores" },
  { to: "/pacientes", label: "Pacientes", icon: PawPrint, perm: "pacientes:read", testid: "pacientes" },
  { to: "/prontuarios", label: "Prontuários", icon: Stethoscope, perm: "prontuario:read", testid: "prontuarios" },
  { to: "/vacinas", label: "Vacinação", icon: Syringe, perm: "vacina:read", testid: "vacinas" },
  { to: "/usuarios", label: "Usuários & Permissões", icon: ShieldCheck, perm: "users:manage", testid: "usuarios" },
];

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const items = NAV.filter((n) => !n.perm || can(n.perm));

  const SidebarInner = () => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary text-primary-foreground">
          <PawPrint className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading font-extrabold leading-tight tracking-tight">VetCare Pro</p>
          <p className="text-[11px] text-slate-400 -mt-0.5">Gestão Veterinária</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            onClick={() => setOpen(false)}
            data-testid={`sidebar-module-${n.testid}-link`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-primary text-primary-foreground font-semibold" : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="grid place-items-center h-9 w-9 rounded-full bg-slate-700 text-sm font-semibold">
            {(user?.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user?.role_label}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          data-testid="logout-button"
          onClick={async () => { await logout(); navigate("/login"); }}
          className="mt-1 w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:block w-64 shrink-0">
        <SidebarInner />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64"><SidebarInner /></div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 md:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-menu-button">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          {can("fila:write") && (
            <Button size="sm" data-testid="topbar-checkin-button" onClick={() => navigate("/recepcao")}>
              <PlusCircle className="h-4 w-4 mr-1.5" /> Check-in
            </Button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
