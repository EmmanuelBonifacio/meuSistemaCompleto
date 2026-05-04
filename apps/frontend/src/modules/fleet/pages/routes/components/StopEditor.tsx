"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Clock, Weight, Star } from "lucide-react";
import type { StopInput } from "../../../types/routes.types";

// ---------------------------------------------------------------------------
// Sortable Stop Item
// ---------------------------------------------------------------------------
interface SortableStopProps {
  stop: StopInput;
  index: number;
  onRemove: (id: string) => void;
  onChange: (id: string, field: keyof StopInput, value: string | number | null) => void;
}

function SortableStop({ stop, index, onRemove, onChange }: SortableStopProps) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          type="button"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div
          className="w-5 h-5 rounded-full bg-[#185FA5] text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 truncate">{stop.address}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {stop.service_duration_min} min serviço
            {stop.weight_kg ? ` · ${stop.weight_kg} kg` : ""}
            {stop.time_window_start ? ` · ${stop.time_window_start}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-[#185FA5] rounded transition-colors"
            title="Editar parada"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(stop.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
            title="Remover parada"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Janela início</label>
            <input
              type="time"
              value={stop.time_window_start ?? ""}
              onChange={(e) => onChange(stop.id, "time_window_start", e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Janela fim</label>
            <input
              type="time"
              value={stop.time_window_end ?? ""}
              onChange={(e) => onChange(stop.id, "time_window_end", e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
              <Weight className="w-3 h-3" /> Peso (kg)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={stop.weight_kg ?? ""}
              onChange={(e) => onChange(stop.id, "weight_kg", e.target.value ? Number(e.target.value) : null)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Serviço (min)</label>
            <input
              type="number"
              min="1"
              value={stop.service_duration_min}
              onChange={(e) => onChange(stop.id, "service_duration_min", Number(e.target.value) || 5)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
              <Star className="w-3 h-3" /> Skill requerida
            </label>
            <input
              type="text"
              value={stop.required_skill ?? ""}
              onChange={(e) => onChange(stop.id, "required_skill", e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              placeholder="ex: refrigerado, fragil"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Observações</label>
            <input
              type="text"
              value={stop.notes ?? ""}
              onChange={(e) => onChange(stop.id, "notes", e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              placeholder="Ligar antes, portaria B..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StopEditor
// ---------------------------------------------------------------------------
interface StopEditorProps {
  stops: StopInput[];
  onChange: (stops: StopInput[]) => void;
}

export function StopEditor({ stops, onChange }: StopEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = stops.findIndex((s) => s.id === active.id);
      const newIdx = stops.findIndex((s) => s.id === over.id);
      onChange(arrayMove(stops, oldIdx, newIdx));
    }
  }

  function handleRemove(id: string) {
    onChange(stops.filter((s) => s.id !== id));
  }

  function handleChange(id: string, field: keyof StopInput, value: string | number | null) {
    onChange(stops.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  if (stops.length === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        Adicione paradas no painel esquerdo
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {stops.map((stop, idx) => (
            <SortableStop
              key={stop.id}
              stop={stop}
              index={idx}
              onRemove={handleRemove}
              onChange={handleChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
