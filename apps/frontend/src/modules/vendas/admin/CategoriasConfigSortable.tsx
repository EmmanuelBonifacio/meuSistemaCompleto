"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Tag, X } from "lucide-react";
import clsx from "clsx";

function SortableCategoriaPill({
  id,
  onRemove,
}: {
  id: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <span
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={clsx(
        "inline-flex max-w-full items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium pl-1 pr-1.5 py-1.5 rounded-full",
        isDragging &&
          "z-20 shadow-md ring-2 ring-indigo-300 opacity-90",
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing rounded p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
        {...attributes}
        {...listeners}
        aria-label={`Arrastar categoria: ${id}`}
      >
        <GripVertical className="w-3.5 h-3.5 flex-shrink-0" />
      </button>
      <Tag className="w-3 h-3 flex-shrink-0" />
      <span className="max-w-[min(180px,40vw)] truncate">{id}</span>
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-red-600 transition-colors ml-0.5 p-0.5 rounded"
        aria-label={`Remover categoria ${id}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// =============================================================================
// Lista arrastável (exc. "lancamentos", que fica fora e fixa no ecrã pai)
// =============================================================================
export function CategoriasConfigSortable({
  categorias,
  setCategorias,
}: {
  categorias: string[];
  setCategorias: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const rest = categorias.filter((c) => c !== "lancamentos");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    const r = rest;
    const oldIndex = r.indexOf(String(active.id));
    const newIndex = r.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setCategorias(["lancamentos", ...arrayMove(r, oldIndex, newIndex)]);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={rest} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-2 items-center">
          {rest.map((cat) => (
            <SortableCategoriaPill
              key={cat}
              id={cat}
              onRemove={() =>
                setCategorias((prev) => prev.filter((c) => c !== cat))
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
