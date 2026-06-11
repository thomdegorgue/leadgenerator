"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, UserPlus, Users, Copy, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import {
  createTeam,
  distributeLeads,
  inviteUser,
  removeMember,
  updateMember,
  type DistributionMode,
} from "@/server/team";
import { initials } from "@/lib/utils";
import type { Role, Team } from "@/lib/types";

export function InviteButton({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const result = await inviteUser({
      email,
      fullName: String(fd.get("fullName") ?? ""),
      role: String(fd.get("role") ?? "vendedor") as Role,
      teamId: String(fd.get("teamId") ?? "") || null,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCredentials({ email, password: result.password });
    router.refresh();
  }

  function close() {
    setOpen(false);
    setCredentials(null);
    setError(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Invitar
      </Button>
      <Modal open={open} onClose={close} title="Invitar al equipo">
        {credentials ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Usuario creado. Pasale estas credenciales — la contraseña{" "}
              <strong className="text-warn">se muestra una sola vez</strong>:
            </p>
            <div className="numeric space-y-1 rounded-lg border border-line bg-surface2 p-4 text-sm">
              <p>{credentials.email}</p>
              <p className="text-accent">{credentials.password}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `ARGOS — tu acceso:\n${location.origin}/login\nEmail: ${credentials.email}\nContraseña: ${credentials.password}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                Copiar acceso
              </Button>
              <Button onClick={close}>Listo</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="i-name">Nombre completo</Label>
              <Input id="i-name" name="fullName" required placeholder="Pedro Gómez" />
            </div>
            <div>
              <Label htmlFor="i-email">Email</Label>
              <Input id="i-email" name="email" type="email" required placeholder="pedro@empresa.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="i-role">Rol</Label>
                <Select id="i-role" name="role" defaultValue="vendedor">
                  <option value="vendedor">Vendedor</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="i-team">Equipo</Label>
                <Select id="i-team" name="teamId" defaultValue="">
                  <option value="">Sin equipo</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" loading={saving} className="w-full">
              Crear usuario
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export interface MemberStats {
  id: string;
  userId: string;
  role: Role;
  teamId: string | null;
  name: string;
  activeLeads: number;
  contacts7d: number;
  responded: number;
  clients: number;
}

export function MemberRow({
  member,
  teams,
  isOwner,
}: {
  member: MemberStats;
  teams: Team[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(fields: { role?: Role; teamId?: string | null }) {
    setBusy(true);
    await updateMember(member.id, fields);
    setBusy(false);
    router.refresh();
  }

  const miniSelect =
    "h-8 rounded-md border border-line bg-surface px-2 text-xs focus:border-accent/60 focus:outline-none disabled:opacity-50";

  return (
    <tr className="bg-surface/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface2 text-[10px] font-semibold text-accent">
            {initials(member.name)}
          </span>
          <span className="truncate text-sm font-medium">{member.name}</span>
        </div>
      </td>
      <td className="numeric px-3 py-3 text-right">{member.activeLeads}</td>
      <td className="numeric px-3 py-3 text-right">{member.contacts7d}</td>
      <td className="numeric px-3 py-3 text-right text-violet-300">{member.responded}</td>
      <td className="numeric px-3 py-3 text-right text-success">{member.clients}</td>
      <td className="px-3 py-3">
        {isOwner ? (
          <div className="flex items-center gap-1.5">
            <select
              value={member.role}
              disabled={busy}
              onChange={(e) => change({ role: e.target.value as Role })}
              className={miniSelect}
            >
              <option value="vendedor">Vendedor</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
            <select
              value={member.teamId ?? ""}
              disabled={busy}
              onChange={(e) => change({ teamId: e.target.value || null })}
              className={miniSelect}
            >
              <option value="">Sin equipo</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={async () => {
                if (confirm(`¿Sacar a ${member.name}? Sus leads activos vuelven al pool.`)) {
                  setBusy(true);
                  await removeMember(member.id);
                  setBusy(false);
                  router.refresh();
                }
              }}
              className="rounded-md p-1.5 text-muted hover:text-danger"
              title="Sacar del equipo"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">
            {member.role}
            {member.teamId && ` · ${teams.find((t) => t.id === member.teamId)?.name ?? ""}`}
          </span>
        )}
      </td>
    </tr>
  );
}

export function EquipoActions({
  unassignedCount,
  teams,
}: {
  unassignedCount: number;
  teams: Team[];
}) {
  const router = useRouter();
  const [distributing, setDistributing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<DistributionMode>("round_robin");
  const [teamName, setTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  async function onDistribute() {
    setDistributing(true);
    setMessage(null);
    const result = await distributeLeads(mode);
    setDistributing(false);
    setMessage(
      result.ok
        ? `${result.assigned} leads repartidos entre ${result.sellers} vendedores.`
        : result.error
    );
    router.refresh();
  }

  async function onCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreatingTeam(true);
    await createTeam(teamName);
    setTeamName("");
    setCreatingTeam(false);
    router.refresh();
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <Card className="flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shuffle className="size-4 text-accent" />
            <h2 className="text-sm font-semibold">Distribución automática</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="numeric text-fg">{unassignedCount}</span> leads nuevos sin asignar.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as DistributionMode)}
            aria-label="Modo de distribución"
            className="flex-1"
          >
            <option value="round_robin">Parejo (round-robin)</option>
            <option value="por_carga">Equilibrar carga</option>
            <option value="por_score">Mejores leads primero</option>
          </Select>
          <Button
            onClick={onDistribute}
            loading={distributing}
            disabled={unassignedCount === 0}
            variant={unassignedCount > 0 ? "primary" : "secondary"}
          >
            Repartir
          </Button>
        </div>
        {message && <p className="text-xs text-muted">{message}</p>}
      </Card>

      <Card className="flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-accent" />
            <h2 className="text-sm font-semibold">Equipos</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            {teams.length > 0 ? teams.map((t) => t.name).join(" · ") : "Todavía no hay equipos."}
          </p>
        </div>
        <form onSubmit={onCreateTeam} className="flex gap-2">
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Nuevo equipo…"
          />
          <Button type="submit" variant="secondary" loading={creatingTeam} disabled={!teamName.trim()}>
            Crear
          </Button>
        </form>
      </Card>
    </section>
  );
}
