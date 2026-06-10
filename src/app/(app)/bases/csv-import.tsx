"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label, Input } from "@/components/ui/field";
import { createCsvRun, importChunk } from "@/server/import";
import type { CanonicalLeadRow, ImportStats } from "@/lib/types";

const FIELDS: { key: keyof CanonicalLeadRow; label: string; guess: RegExp }[] = [
  { key: "name", label: "Nombre *", guess: /nombre|name|negocio|empresa|raz[oó]n/i },
  { key: "phone", label: "Teléfono", guess: /tel|phone|cel|whats/i },
  { key: "category", label: "Rubro", guess: /rubro|categor|category|nicho/i },
  { key: "city", label: "Ciudad", guess: /ciudad|city|localidad/i },
  { key: "province", label: "Provincia", guess: /provincia|state|region/i },
  { key: "address", label: "Dirección", guess: /direcci|address|domicilio/i },
  { key: "website", label: "Web", guess: /web|site|url|dominio/i },
  { key: "instagram", label: "Instagram", guess: /insta|ig/i },
  { key: "email", label: "Email", guess: /mail|correo/i },
];

const CHUNK = 400;

type Step = "pick" | "map" | "importing" | "done";

export function CsvImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? [];
        if (!cols.length || !result.data.length) {
          setError("No se pudieron leer filas del archivo. ¿Tiene encabezados?");
          return;
        }
        setHeaders(cols);
        setRows(result.data);
        const auto: Record<string, string> = {};
        FIELDS.forEach((f) => {
          const match = cols.find((c) => f.guess.test(c));
          if (match) auto[f.key] = match;
        });
        setMapping(auto);
        setStep("map");
      },
      error: () => setError("Error al parsear el CSV."),
    });
  }

  async function runImport() {
    if (!mapping.name) {
      setError("Mapeá al menos la columna de nombre.");
      return;
    }
    setStep("importing");
    setError(null);
    setProgress(0);

    const canonical: CanonicalLeadRow[] = rows
      .map((row) => {
        const value = (key: string) => {
          const col = mapping[key];
          return col ? row[col]?.trim() || null : null;
        };
        return {
          name: value("name") ?? "",
          phone: value("phone"),
          category: value("category"),
          city: value("city"),
          province: value("province"),
          address: value("address"),
          website: value("website"),
          instagram: value("instagram"),
          email: value("email"),
        };
      })
      .filter((r) => r.name);

    const created = await createCsvRun(fileName.replace(/\.csv$/i, ""));
    if (!created.ok) {
      setError(created.error);
      setStep("map");
      return;
    }

    const total: ImportStats = { found: 0, inserted: 0, duplicates: 0 };
    for (let i = 0; i < canonical.length; i += CHUNK) {
      const result = await importChunk(created.runId, canonical.slice(i, i + CHUNK));
      if (!result.ok) {
        setError(result.error);
        setStep("map");
        return;
      }
      total.found += result.stats.found;
      total.inserted += result.stats.inserted;
      total.duplicates += result.stats.duplicates;
      setProgress(Math.min(100, Math.round(((i + CHUNK) / canonical.length) * 100)));
    }

    setStats(total);
    setStep("done");
    router.refresh();
  }

  function reset() {
    setStep("pick");
    setRows([]);
    setHeaders([]);
    setMapping({});
    setStats(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">Importar CSV</h2>
      </div>

      {step === "pick" && (
        <div>
          <p className="mb-3 text-sm text-muted">
            Subí cualquier listado con encabezados. Después mapeás las columnas.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line py-8 text-muted transition-colors hover:border-accent/50 hover:text-fg">
            <Upload className="size-6" />
            <span className="text-sm">Elegir archivo .csv</span>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="hidden"
            />
          </label>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            <span className="numeric text-fg">{rows.length}</span> filas en {fileName}. Mapeá columnas:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={runImport} className="flex-1">
              Importar {rows.length} filas
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="space-y-3 py-4">
          <p className="text-center text-sm text-muted">Importando y deduplicando…</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface2">
            <div
              className="glow-accent h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="numeric text-center text-xs text-muted">{progress}%</p>
        </div>
      )}

      {step === "done" && stats && (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm">
            <span className="numeric text-2xl font-semibold text-success">{stats.inserted}</span>{" "}
            <span className="text-muted">leads nuevos</span>
          </p>
          <p className="text-xs text-muted">
            {stats.duplicates} duplicados ignorados de {stats.found} filas
          </p>
          <Button variant="secondary" onClick={reset}>
            Importar otro
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </Card>
  );
}
