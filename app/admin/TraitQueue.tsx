'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Trait } from '@/lib/types'

interface Props {
  queue: Trait[]
  usedTraits: Trait[]
  disabled: boolean
  onReorder: (newQueue: Trait[]) => void
}

function SortableItem({ trait, index, disabled }: { trait: Trait; index: number; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: trait.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors select-none ${
        isDragging
          ? 'opacity-40 scale-95 bg-slate-700 border border-white/20 shadow-xl z-50'
          : index === 0
          ? 'bg-amber-500/15 border border-amber-500/40'
          : 'bg-slate-800/60 border border-transparent hover:border-white/10'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        className={`flex flex-col gap-[3px] shrink-0 touch-none p-0.5 rounded ${
          disabled ? 'opacity-20 cursor-default' : 'cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80'
        }`}
        aria-label="גרור לסידור מחדש"
      >
        {[0, 1, 2].map(i => (
          <span key={i} className="flex gap-[3px]">
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
          </span>
        ))}
      </button>

      {/* Position indicator */}
      <span className={`text-xs font-black shrink-0 w-5 text-center ${
        index === 0 ? 'text-amber-400' : 'text-slate-600'
      }`}>
        {index === 0 ? '▶' : index + 1}
      </span>

      {/* Title */}
      <span className={`flex-1 font-medium truncate text-sm ${
        index === 0 ? 'text-amber-200' : 'text-slate-300'
      }`}>
        {trait.title}
      </span>

      {index === 0 && (
        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded">
          הבא
        </span>
      )}
    </div>
  )
}

export function TraitQueue({ queue, usedTraits, disabled, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = queue.findIndex(t => t.id === active.id)
    const newIdx = queue.findIndex(t => t.id === over.id)
    onReorder(arrayMove(queue, oldIdx, newIdx))
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">תור תכונות</p>
        {queue.length > 0 && (
          <span className="text-[10px] text-slate-600">{queue.length} נותרו</span>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="px-3 py-5 text-center text-slate-600 text-xs bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
          כל התכונות שימשו 🎉
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={queue.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {queue.map((trait, i) => (
                <SortableItem key={trait.id} trait={trait} index={i} disabled={disabled} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {usedTraits.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-slate-700 uppercase tracking-wide mb-1.5">שימשו</p>
          <div className="flex flex-col gap-1">
            {usedTraits.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-700 bg-slate-800/20">
                <span className="shrink-0">✓</span>
                <span className="line-through truncate">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
