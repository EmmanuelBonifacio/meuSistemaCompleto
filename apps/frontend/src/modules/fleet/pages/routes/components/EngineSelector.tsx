"use client";

import React from "react";
import { Zap, Settings, Layers } from "lucide-react";
import type { RouteEngine } from "../../../types/routes.types";

interface Props {
  value: RouteEngine;
  onChange: (engine: RouteEngine) => void;
}

const engines: Array<{
  id: RouteEngine;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}> = [
  {
    id: "vroom",
    label: "VROOM",
    description: "Otimização rápida — resultado em milissegundos",
    icon: <Zap className="w-4 h-4" />,
    badge: "Recomendado",
  },
  {
    id: "ortools",
    label: "OR-Tools",
    description: "Restrições avançadas: skills, SLA, veículo obrigatório",
    icon: <Settings className="w-4 h-4" />,
  },
  {
    id: "combined",
    label: "Combinado",
    description: "VROOM gera, OR-Tools refina para máxima qualidade",
    icon: <Layers className="w-4 h-4" />,
  },
];

export function EngineSelector({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Motor de otimização
      </label>
      <div className="flex flex-col gap-2">
        {engines.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onChange(e.id)}
            className={`
              flex items-start gap-3 p-3 rounded-lg border text-left transition-all
              ${value === e.id
                ? "border-[#185FA5] bg-[#E6F1FB]"
                : "border-gray-200 bg-white hover:border-gray-300"}
            `}
          >
            <span
              className={`mt-0.5 ${value === e.id ? "text-[#185FA5]" : "text-gray-400"}`}
            >
              {e.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    value === e.id ? "text-[#185FA5]" : "text-gray-700"
                  }`}
                >
                  {e.label}
                </span>
                {e.badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    {e.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>
            </div>
            <span
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                value === e.id
                  ? "border-[#185FA5] bg-[#185FA5]"
                  : "border-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
