import { ShieldAlert } from "lucide-react";

export default function SinAccesoPage() {
  return (
    <main className="argos-bg flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="rounded-2xl border border-warn/30 bg-warn/10 p-4">
        <ShieldAlert className="size-8 text-warn" />
      </span>
      <h1 className="text-lg font-semibold">Tu cuenta no tiene acceso todavía</h1>
      <p className="max-w-sm text-sm text-muted">
        Pedile al administrador que te agregue a la organización. Si sos el administrador,
        corré <code className="rounded bg-surface2 px-1.5 py-0.5 text-xs">superadmin.sql</code> en
        Supabase con tu email.
      </p>
      <form action="/auth/signout" method="post">
        <button className="text-sm text-accent hover:underline">Cerrar sesión</button>
      </form>
    </main>
  );
}
