import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const [params] = useSearchParams();
  const initial = params.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, role } = useAuth();

  useEffect(() => {
    if (user && role) {
      const dest = role === "admin" ? "/admin" : role === "barber" ? "/barber" : "/cliente";
      navigate(dest, { replace: true });
    }
  }, [user, role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. ¡Bienvenido!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-dark">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <span className="text-3xl font-display font-bold tracking-wider">
            <span className="text-gold">JATERE</span> BARBER
          </span>
        </Link>
        <Card className="border-border shadow-elegant">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {mode === "login" ? "Ingresar" : "Crear cuenta"}
            </CardTitle>
            <CardDescription>
              {mode === "login" ? "Accedé a tu panel" : "Registrate para reservar tu turno"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div>
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold text-primary-foreground hover:bg-gold/90 uppercase tracking-widest">
                {loading ? "..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              {mode === "login" ? (
                <button onClick={() => setMode("signup")} className="text-gold hover:underline">
                  ¿No tenés cuenta? Registrate
                </button>
              ) : (
                <button onClick={() => setMode("login")} className="text-gold hover:underline">
                  ¿Ya tenés cuenta? Ingresá
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
