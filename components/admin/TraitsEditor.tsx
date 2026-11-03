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
import { TRAIT_CATEGORIES, type TraitCategory } from '@/lib/types'
import { Button, FIELD, FIELD_BAD } from '@/components/evening/ui'
import { lotNo } from '@/components/evening/units'

/** A statement row as edited in the form (key is a client-side id for React/dnd). */
export interface TraitDraft {
  key: string
  id?: string
  title: string
  description: string
  category: TraitCategory | ''
}

interface Props {
  traits: TraitDraft[]
  disabled: boolean
  /** Keys of rows that failed validation on the last save. */
  invalidKeys?: ReadonlySet<string>
  onChange: (traits: TraitDraft[]) => void
}

export function newTraitDraft(): TraitDraft {
  return { key: `new-${Math.random().toString(36).slice(2, 10)}`, title: '', description: '', category: '' }
}

const OP = 'flex h-9 w-9 items-center justify-center rounded-[9px] text-ivory-mute transition-colors hover:bg-velvet-3 hover:text-ivory disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ivory-mute'

function Row({
  trait, index, count, disabled, bad, onChange, onRemove, onMove,
}: {
  trait: TraitDraft
  index: number
  count: number
  disabled: boolean
  bad: boolean
  onChange: (t: TraitDraft) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: trait.key, disabled })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border bg-velvet-1 px-2.5 py-2 min-[700px]:grid-cols-[34px_minmax(0,1fr)_150px_auto] ${
        isDragging ? 'z-10 border-velvet-4 opacity-60 shadow-[var(--shadow-menu)]' : 'border-velvet-3'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label={`גרירת פריט ${index + 1} לסידור מחדש`}
        className={`num flex h-9 touch-none items-center justify-center rounded text-[18px] text-ivory-mute ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {lotNo(index + 1)}
      </button>
      <label className="min-w-0">
        <span className="sr-only">טקסט פריט {index + 1}</span>
        <input
          type="text"
          value={trait.title}
          onChange={e => onChange({ ...trait, title: e.target.value })}
          placeholder="למשל: הקשבה"
          maxLength={120}
          disabled={disabled}
          aria-invalid={bad || undefined}
          className={`${FIELD} ${bad ? FIELD_BAD : ''}`}
        />
      </label>
      <label className="col-start-2 min-[700px]:col-start-auto">
        <span className="sr-only">קטגוריה של פריט {index + 1}</span>
        <select
          value={trait.category}
          onChange={e => onChange({ ...trait, category: e.target.value as TraitCategory })}
          disabled={disabled}
          aria-invalid={(bad && !trait.category) || undefined}
          className={`${FIELD} ${!trait.category ? 'text-ivory-mute' : ''} ${bad && !trait.category ? FIELD_BAD : ''}`}
        >
          <option value="" disabled>קטגוריה</option>
          {TRAIT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <span className="col-start-2 flex justify-end gap-0.5 min-[700px]:col-start-auto">
        <button type="button" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`הזזת פריט ${index + 1} למעלה`} className={OP}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`הזזת פריט ${index + 1} למטה`} className={OP}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" onClick={onRemove} disabled={disabled || count <= 1} aria-label={`הסרת פריט ${index + 1}`} className={OP}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 5h12M7 5V3.5h4V5M5 5l.8 10h6.4L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </span>
      <label className="col-span-full">
        <span className="sr-only">תיאור קצר של פריט {index + 1}</span>
        <input
          type="text"
          value={trait.description}
          onChange={e => onChange({ ...trait, description: e.target.value })}
          placeholder="תיאור קצר (לא חובה)"
          maxLength={500}
          disabled={disabled}
          className={`${FIELD} h-9 text-[14px] text-ivory-dim`}
        />
      </label>
    </li>
  )
}

/** Statement list editor: add, edit, move, remove and drag to reorder. Every statement needs a category. */
export default function TraitsEditor({ traits, disabled, invalidKeys, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = traits.findIndex(t => t.key === active.id)
    const to = traits.findIndex(t => t.key === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(traits, from, to))
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta
    if (to < 0 || to >= traits.length) return
    onChange(arrayMove(traits, index, to))
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={traits.map(t => t.key)} strategy={verticalListSortingStrategy}>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {traits.map((t, i) => (
              <Row
                key={t.key}
                trait={t}
                index={i}
                count={traits.length}
                disabled={disabled}
                bad={invalidKeys?.has(t.key) ?? false}
                onChange={next => onChange(traits.map(x => (x.key === t.key ? next : x)))}
                onRemove={() => onChange(traits.filter(x => x.key !== t.key))}
                onMove={delta => move(i, delta)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!disabled && (
        <Button onClick={() => onChange([...traits, newTraitDraft()])} disabled={traits.length >= 50} className="w-full">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          הוספת פריט
        </Button>
      )}
    </div>
  )
}
