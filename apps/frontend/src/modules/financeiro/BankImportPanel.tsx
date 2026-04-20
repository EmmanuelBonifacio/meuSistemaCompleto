"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importBankCsv } from "@/services/financeiro.service";
import type { ImportBankCsvResult, TransactionType } from "@/types/api";

export function BankImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [defaultType, setDefaultType] = useState<TransactionType>("despesa");
  const [useAiCategorization, setUseAiCategorization] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportBankCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await importBankCsv(file, {
        defaultType,
        useAiCategorization,
        skipDuplicates,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar CSV.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importar extrato bancário (CSV)</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleImport}>
            <div className="space-y-1.5">
              <Label>Arquivo CSV</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Cabeçalhos aceitos: data/date, descricao/description, valor/amount, tipo/type, categoria/category, fornecedor/supplier, centro_custo/cost_center.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo padrão</Label>
                <Select
                  value={defaultType}
                  onValueChange={(v) => setDefaultType(v as TransactionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 rounded-lg border px-3">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                <span className="text-sm">Ignorar duplicadas</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border px-3">
                <input
                  type="checkbox"
                  checked={useAiCategorization}
                  onChange={(e) => setUseAiCategorization(e.target.checked)}
                />
                <span className="text-sm">Classificar com IA (Ollama)</span>
              </label>
            </div>

            <div className="flex justify-end">
              <Button type="submit" isLoading={isLoading} disabled={!file}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Importar CSV
              </Button>
            </div>
          </form>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado da importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded border p-3">
                <p className="text-muted-foreground text-xs">Importadas</p>
                <p className="text-2xl font-semibold text-emerald-600">{result.imported}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-muted-foreground text-xs">Duplicadas</p>
                <p className="text-2xl font-semibold">{result.duplicated}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-muted-foreground text-xs">Ignoradas/erro</p>
                <p className="text-2xl font-semibold text-red-600">{result.skipped}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
                <p className="font-medium mb-2">Linhas com erro</p>
                <ul className="space-y-1 text-xs">
                  {result.errors.slice(0, 20).map((item, idx) => (
                    <li key={`${item.row}-${idx}`}>
                      Linha {item.row}: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
