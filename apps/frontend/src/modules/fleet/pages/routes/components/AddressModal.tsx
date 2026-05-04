"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, MapPin, Search } from "lucide-react";
import {
  geocodeByCep,
  geocodeStructuredAddress,
} from "@/modules/fleet/services/routes.api";

export interface GeoResult {
  lat: number | null;
  lng: number | null;
  address: string;
  city?: string;
  state?: string;
  cep?: string;
  needsManualPin?: boolean;
}

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (result: GeoResult) => void;
  /** Se true, permite confirmar CEP sem coordenadas (ex.: depósito). Paradas: false. */
  allowConfirmWithoutCoords?: boolean;
}

type Tab = "cep" | "manual";
type CepStatus = "idle" | "loading" | "found" | "found_no_coords" | "error";

function formatCep(digits: string): string {
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  return digits;
}

export function AddressModal({
  open,
  title,
  onClose,
  onConfirm,
  allowConfirmWithoutCoords = false,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [tab, setTab] = useState<Tab>("cep");

  const [cep, setCep] = useState("");
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const [cepResult, setCepResult] = useState<GeoResult | null>(null);

  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualState, setManualState] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (open) {
      setTab("cep");
      setCep("");
      setCepStatus("idle");
      setCepResult(null);
      setManualAddress("");
      setManualCity("");
      setManualState("");
      setManualError("");
    }
  }, [open]);

  const handleCepChange = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setCep(formatCep(digits));
    setCepResult(null);

    if (digits.length === 8) {
      setCepStatus("loading");
      try {
        const data = await geocodeByCep(digits);
        if (!data) throw new Error("not found");
        setCepResult(data);
        const noCoords =
          data.needsManualPin === true ||
          data.lat == null ||
          data.lng == null;
        setCepStatus(noCoords ? "found_no_coords" : "found");
      } catch {
        setCepStatus("error");
      }
    } else {
      setCepStatus("idle");
    }
  }, []);

  const handleManualSearch = useCallback(async () => {
    if (!manualAddress.trim()) {
      setManualError("Preencha o logradouro.");
      return;
    }
    if (!manualCity.trim()) {
      setManualError("A cidade é obrigatória para encontrar o endereço.");
      return;
    }
    setManualLoading(true);
    setManualError("");
    try {
      const data = await geocodeStructuredAddress(
        manualAddress.trim(),
        manualCity.trim(),
        manualState.trim().toUpperCase() || undefined,
      );
      if (!data) throw new Error("not found");
      if (data.lat == null || data.lng == null) {
        setManualError(
          "Não foi possível obter coordenadas. Ajuste o endereço ou tente outra grafia.",
        );
        return;
      }
      onConfirm(data);
      onClose();
    } catch {
      setManualError(
        "Endereço não encontrado. Verifique o nome da rua, cidade e estado.",
      );
    } finally {
      setManualLoading(false);
    }
  }, [manualAddress, manualCity, manualState, onConfirm, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[95vw] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#185FA5]" />
            <span className="text-[15px] font-semibold text-gray-800">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 px-6">
          {(["cep", "manual"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`py-3 px-1 mr-6 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-[#185FA5] text-[#185FA5]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "cep" ? "Buscar por CEP" : "Endereço completo"}
            </button>
          ))}
        </div>

        <div className="px-6 py-5">
          {tab === "cep" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
                  CEP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="Ex: 38600-514"
                  maxLength={9}
                  autoFocus
                  className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent transition-colors"
                />
              </div>

              {cepStatus === "loading" && (
                <div className="flex items-center gap-2 text-[13px] text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando CEP...
                </div>
              )}

              {cepStatus === "error" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] text-red-600">
                    CEP não encontrado. Tente informar o endereço completo.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("manual")}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Informar endereço completo
                  </button>
                </div>
              )}

              {cepStatus === "found" && cepResult && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2.5 p-3.5 bg-green-50 border border-green-200 rounded-lg">
                    <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-green-800">
                        {cepResult.address}
                      </p>
                      {cepResult.city && (
                        <p className="text-[12px] text-green-700 mt-0.5">
                          {cepResult.city}
                          {cepResult.state ? ` - ${cepResult.state}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onConfirm(cepResult);
                      onClose();
                    }}
                    className="w-full py-2.5 bg-[#185FA5] hover:bg-[#1456a0] text-white text-[13px] font-semibold rounded-lg transition-colors"
                  >
                    Confirmar endereço
                  </button>
                </div>
              )}

              {cepStatus === "found_no_coords" && cepResult && (
                <div className="flex flex-col gap-3">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-amber-900">
                    <p className="font-medium text-amber-950 mb-1">
                      Endereço encontrado, mas não foi possível localizar no mapa
                      automaticamente.
                    </p>
                    <p className="font-semibold text-amber-950">{cepResult.address}</p>
                    {cepResult.city && (
                      <p className="text-[12px] text-amber-900/90 mt-1">
                        {cepResult.city}
                        {cepResult.state ? ` - ${cepResult.state}` : ""}
                      </p>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-600">
                    Você pode confirmar para usar só o texto do endereço (sem pin) ou
                    informar o endereço completo para tentar obter coordenadas.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {allowConfirmWithoutCoords ? (
                      <button
                        type="button"
                        onClick={() => {
                          onConfirm(cepResult);
                          onClose();
                        }}
                        className="flex-1 py-2.5 px-3 text-[13px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-800 transition-colors"
                      >
                        Confirmar sem pin
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setTab("manual")}
                      className="flex-1 py-2.5 px-3 text-[13px] font-semibold rounded-lg bg-[#185FA5] hover:bg-[#1456a0] text-white transition-colors"
                    >
                      Informar endereço completo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "manual" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
                  Logradouro e número <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => {
                    setManualAddress(e.target.value);
                    setManualError("");
                  }}
                  placeholder="Ex: Rua Tenente Olímpio Gonzaga, 210"
                  autoFocus
                  onKeyDown={(e) =>
                    e.key === "Enter" && !manualLoading && handleManualSearch()
                  }
                  className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent transition-colors"
                />
              </div>

              <div className="grid grid-cols-[1fr_88px] gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
                    Cidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualCity}
                    onChange={(e) => {
                      setManualCity(e.target.value);
                      setManualError("");
                    }}
                    placeholder="Ex: Paracatu"
                    onKeyDown={(e) =>
                      e.key === "Enter" && !manualLoading && handleManualSearch()
                    }
                    className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
                    UF
                  </label>
                  <input
                    type="text"
                    value={manualState}
                    onChange={(e) =>
                      setManualState(e.target.value.toUpperCase().slice(0, 2))
                    }
                    placeholder="MG"
                    maxLength={2}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !manualLoading && handleManualSearch()
                    }
                    className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent uppercase transition-colors"
                  />
                </div>
              </div>

              {manualError && (
                <p className="text-[13px] text-red-600">{manualError}</p>
              )}

              <button
                type="button"
                onClick={handleManualSearch}
                disabled={manualLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#185FA5] hover:bg-[#1456a0] text-white text-[13px] font-semibold rounded-lg disabled:opacity-60 transition-colors"
              >
                {manualLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Buscar e confirmar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
