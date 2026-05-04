import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Scissors, Sparkles, Calendar, Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const services = [
  { name: "Corte", desc: "Cortes personalizados según visagismo", icon: Scissors },
  { name: "Barba", desc: "Diseño y mantenimiento de barba", icon: Award },
  { name: "Cejas", desc: "Perfilado masculino preciso", icon: Sparkles },
  { name: "Mascarilla", desc: "Cuidado facial premium", icon: Sparkles },
  { name: "Lavado", desc: "Lavado capilar y relajación", icon: Sparkles },
];

const Index = () => {
  const { user, role } = useAuth();
  const dashHref = role === "admin" ? "/admin" : role === "barber" ? "/barber" : "/cliente";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-display font-bold tracking-wider">
              <span className="text-gold">JATERE</span>
              <span className="text-foreground/90 ml-1">BARBER</span>
            </span>
          </Link>
          <nav className="hidden md:flex gap-8 text-sm uppercase tracking-widest">
            <a href="#servicios" className="hover:text-gold transition">Servicios</a>
            <a href="#nosotros" className="hover:text-gold transition">Nosotros</a>
            <a href="#contacto" className="hover:text-gold transition">Contacto</a>
          </nav>
          <div className="flex gap-2">
            {user ? (
              <Button asChild className="bg-gold text-primary-foreground hover:bg-gold/90">
                <Link to={dashHref}>Mi panel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hover:text-gold">
                  <Link to="/auth">Ingresar</Link>
                </Button>
                <Button asChild className="bg-gold text-primary-foreground hover:bg-gold/90">
                  <Link to="/auth?mode=signup">Reservar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden gradient-dark">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(43 74% 52% / 0.3), transparent 60%)'
        }} />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/40 bg-gold/5">
              <Sparkles className="w-4 h-4 text-gold" />
              <span className="text-xs uppercase tracking-[0.25em] text-gold">Premium Barbershop</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight">
              Expertos en cortes <br /> y <span className="text-gold italic">visagismo</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Te ayudamos a encontrar tu mejor versión. Reservá tu turno online y viví la experiencia Jatere.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button asChild size="lg" className="bg-gold text-primary-foreground hover:bg-gold/90 shadow-gold uppercase tracking-widest">
                <Link to={user ? dashHref : "/auth?mode=signup"}>
                  <Calendar className="mr-2" /> Reservar turno
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-gold/40 text-gold hover:bg-gold/10 uppercase tracking-widest">
                <a href="#servicios">Ver servicios</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-gold uppercase tracking-[0.3em] text-xs mb-4">Nuestros servicios</p>
            <h2 className="text-4xl md:text-5xl font-display font-semibold">Estilo & precisión</h2>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            {services.map(s => (
              <div key={s.name} className="group p-6 rounded-lg border border-border hover:border-gold/50 transition bg-background hover:shadow-gold">
                <s.icon className="w-8 h-8 text-gold mb-4" />
                <h3 className="text-xl font-display font-semibold mb-2">{s.name}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="nosotros" className="py-24">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center max-w-5xl">
          <div>
            <p className="text-gold uppercase tracking-[0.3em] text-xs mb-4">Sobre nosotros</p>
            <h2 className="text-4xl font-display font-semibold mb-6">Una experiencia diferente</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              En Jatere Barber combinamos técnica, estilo y atención personalizada. Aplicamos visagismo para encontrar el corte
              que mejor potencia tus rasgos.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Reservá online, elegí tu barbero y olvidate de las esperas.
            </p>
          </div>
          <div className="relative aspect-square rounded-lg gradient-gold p-1">
            <div className="w-full h-full bg-card rounded-lg flex items-center justify-center">
              <Scissors className="w-32 h-32 text-gold" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacto" className="border-t border-border py-12 bg-card">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-display font-bold mb-2"><span className="text-gold">JATERE</span> BARBER</h3>
          <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} — Todos los derechos reservados</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
