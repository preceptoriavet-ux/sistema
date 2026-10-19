import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Tutores from "@/pages/Tutores";
import Pacientes from "@/pages/Pacientes";
import Agenda from "@/pages/Agenda";
import Recepcao from "@/pages/Recepcao";
import Prontuarios from "@/pages/Prontuarios";
import Triagem from "@/pages/Triagem";
import Exames from "@/pages/Exames";
import Vacinas from "@/pages/Vacinas";
import Usuarios from "@/pages/Usuarios";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return <div className="grid h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/recepcao" element={<Protected><Recepcao /></Protected>} />
      <Route path="/agenda" element={<Protected><Agenda /></Protected>} />
      <Route path="/tutores" element={<Protected><Tutores /></Protected>} />
      <Route path="/pacientes" element={<Protected><Pacientes /></Protected>} />
      <Route path="/prontuarios" element={<Protected><Prontuarios /></Protected>} />
      <Route path="/triagem" element={<Protected><Triagem /></Protected>} />
      <Route path="/exames" element={<Protected><Exames /></Protected>} />
      <Route path="/vacinas" element={<Protected><Vacinas /></Protected>} />
      <Route path="/usuarios" element={<Protected><Usuarios /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
