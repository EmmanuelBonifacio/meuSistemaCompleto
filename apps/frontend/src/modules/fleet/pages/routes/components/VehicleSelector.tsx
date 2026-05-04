"use client";

import React from "react";
import { Truck, User } from "lucide-react";
import type { VehicleInput } from "../../../types/routes.types";

interface Props {
  vehicles: VehicleInput[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function VehicleSelector({ vehicles, selected, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        Nenhum veículo disponível. Cadastre veículos e motoristas primeiro.
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Veículos disponíveis
        {selected.length > 0 && (
          <span className="ml-2 text-xs font-normal text-[#185FA5]">
            {selected.length} selecionado{selected.length > 1 ? "s" : ""}
          </span>
        )}
      </label>
      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
        {vehicles.map((v) => {
          const isSelected = selected.includes(v.id);
          return (
            <label
              key={v.id}
              className={`
                flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected
                  ? "border-[#185FA5] bg-[#E6F1FB]"
                  : "border-gray-200 bg-white hover:border-gray-300"}
              `}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(v.id)}
                className="mt-0.5 accent-[#185FA5]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {v.plate}
                    {v.model && (
                      <span className="font-normal text-gray-500"> - {v.model}</span>
                    )}
                  </span>
                </div>
                {v.driverName && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{v.driverName}</span>
                  </div>
                )}
                {(v.capacity_kg > 0 || v.capacity_m3 > 0) && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {v.capacity_kg > 0 && `${v.capacity_kg} kg`}
                    {v.capacity_kg > 0 && v.capacity_m3 > 0 && " · "}
                    {v.capacity_m3 > 0 && `${v.capacity_m3} m³`}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
