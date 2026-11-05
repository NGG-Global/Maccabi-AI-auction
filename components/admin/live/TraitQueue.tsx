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
import { lotNo } from '@/components/game/units'

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
      className={`flex select-none items-center gap-2 rounded-[12px] border-2 px-2.5 py-2 text-[14px] transition-colors ${
        isDragging
          ? 'z-50 border-ink bg-card opacity-70 shadow-piece-sm'
          : index === 0
          ? 'border-ink bg-sun-tint'
          : 'border-mint-line bg-zebra hover:border-ink'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        className={`flex shrink-0 touch-none flex-col gap-[3px] rounded p-0.5 ${
          disabled ? 'cursor-default opacity-20' : 'cursor-grab opacity-50 hover:opacity-90 active:cursor-grabbing'
        }`}
        aria-label="גרירה לסידור מחדש"
      >
        {[0, 1, 2].map(i => (
          <span key={i} className="flex gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-current" />
            <span className="h-[3px] w-[3px] rounded-full bg-current" />
          </span>
        ))}
      </button>
      <span className={`num w-6 shrink-0 text-center text-[13px] ${index === 0 ? 'text-ink' : 'text-ink-3'}`}>
        {lotNo(index + 1)}
      </span>
      <span className={`flex-1 truncate font-medium ${index === 0 ? 'text-ink' : 'text-ink-2'}`}>{trait.title}</span>
      {index === 0 && <span className="shrink-0 text-[11px] font-bold text-tomato-text">הבא</span>}
    </div>
  )
}

/** The order of the lots still to be opened: drag to reorder while no round is open. */
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
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 text-[13px] font-semibold text-ink-3">סדר הפריטים הבאים</p>
        {queue.length > 0 && <span className="text-[12px] text-ink-3">{queue.length} נותרו</span>}
      </div>

      {queue.length === 0 ? (
        <div className="rounded-[12px] border-2 border-dashed border-muted-outline px-3 py-4 text-center text-[13px] text-ink-3">
          כל הפריטים נמכרו
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
          <p className="m-0 mb-1.5 text-[12px] text-ink-3">נמכרו</p>
          <div className="flex flex-col gap-1">
            {usedTraits.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] text-ink-3">
                <span className="shrink-0 text-tomato">·</span>
                <span className="truncate line-through decoration-muted-outline">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
