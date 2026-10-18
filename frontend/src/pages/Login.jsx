import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PawPrint, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1725409796872-8b41e8eca929?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
          alt="Veterinária atendendo filhote"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/55" />
        <div className="absolute bottom-0 p-12 text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary"><PawPrint className="h-6 w-6" /></div>
            <span className="font-heading text-2xl font-extrabold">VetCare Pro</span>
          </div>
          <h2 className="font-heading text-3xl font-bold leading-tight max-w-md">
            Gestão completa para sua clínica veterinária
          </h2>
          <p className="mt-3 text-white/80 max-w-md">
            Cadastros, agenda, recepção e prontuários clínicos em um só lugar.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <form onSubmit={submit} className="w-full max-w-sm animate-fade-up" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary text-primary-foreground"><PawPrint className="h-5 w-5" /></div>
            <span className="font-heading text-xl font-extrabold">VetCare Pro</span>
          </div>
          <h1 className="font-heading text-2xl font-bold">Bem-vindo de volta</h1>
          <p className="text-sm text-muted-foreground mb-6">Entre com suas credenciais para acessar o sistema.</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" data-testid="login-email-input" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" data-testid="login-password-input" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="mt-1.5" />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-button">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
