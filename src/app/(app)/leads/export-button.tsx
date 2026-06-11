"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportLeadsCsv } from "@/server/export";
import type { LeadFilterParams } from "@/lib/lead-filters";

export function ExportButton({ filters }: { filters: LeadFilterParams }) {
  const [loading, setLoading] = useState(false);

  async function onExport() {
    setLoading(true);
    const result = await exportLeadsCsv(filters);
    setLoading(false);
    if (!result.ok) return;

    const blob = new Blob([`﻿${result.csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argos-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={onExport} loading={loading} title="Exportar filtro actual">
      <Download className="size-4" /> CSV
    </Button>
  );
}
