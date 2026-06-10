import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="argos-bg flex min-h-dvh items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="glow-accent flex items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <Eye className="size-8 text-accent" />
          </span>
          <h1 className="text-2xl font-bold tracking-[0.35em]">ARGOS</h1>
          <p className="text-xs uppercase tracking-widest text-muted">
            Sistema Operativo Comercial
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-[11px] text-muted">
          El que todo lo ve · acceso solo para el equipo
        </p>
      </div>
    </main>
  );
}
