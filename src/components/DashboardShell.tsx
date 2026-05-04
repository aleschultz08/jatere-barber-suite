import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import { ReactNode } from "react";

export const DashboardShell = ({ title, children }: { title: string; children: ReactNode }) => {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-display font-bold">
            <span className="text-gold">JATERE</span> BARBER
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="hover:text-gold">
              <LogOut className="w-4 h-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-semibold mb-6 text-gold">{title}</h1>
        {children}
      </main>
    </div>
  );
};
