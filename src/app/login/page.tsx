import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso" };

export default function LoginPage() {
  return (
    <main className="argos-bg flex min-h-dvh items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <span className="relative flex size-20 items-center justify-center">
            <span className="eye-ring absolute inset-0 rounded-full border border-dashed border-accent/40" />
            <span className="absolute inset-2 rounded-full border-2 border-accent" />
            <span className="glow-accent size-4 rounded-full bg-accent" />
          </span>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-[0.4em] text-fg">ARGOS</h1>
            <p className="microlabel mt-2">Sistema Operativo Comercial</p>
          </div>
        </div>
        <LoginForm />
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="pulse-dot size-1.5 rounded-full bg-success" />
          <p className="microlabel">El que todo lo ve · acceso restringido</p>
        </div>
      </div>
    </main>
  );
}
