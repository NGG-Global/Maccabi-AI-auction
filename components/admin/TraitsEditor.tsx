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
  onChange: (traits: TraitDraft[]) => void
}

export function newTraitDraft(): TraitDraft {
  return { key: `new-${Math.random().toString(36).slice(2, 10)}`, title: '', description: '', category: '' }
}

function Row({
  trait, index, disabled, onChange, onRemove, canRemove,
}: {
  trait: TraitDraft
  index: number
  disabled: boolean
  onChange: (t: TraitDraft) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: trait.key, disabled })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border p-3 flex flex-col gap-2 ${
        isDragging ? 'opacity-50 bg-slate-700 border-white/20 shadow-xl' : 'bg-slate-800/60 border-white/10'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label="גרור לסידור מחדש"
          className={`flex flex-col gap-[3px] shrink-0 touch-none p-1 rounded ${
            disabled ? 'opacity-20 cursor-default' : 'cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80'
          }`}
        >
          {[0, 1, 2].map(i => (
            <span key={i} className="flex gap-[3px]">
              <span className="w-[3px] h-[3px] rounded-full bg-current" />
              <span className="w-[3px] h-[3px] rounded-full bg-current" />
            </span>
          ))}
        </button>
        <span className="text-xs font-black text-slate-500 w-5 text-center shrink-0">{index + 1}</span>
        <input
          type="text"
          value={trait.title}
          onChange={e => onChange({ ...trait, title: e.target.value })}
          placeholder="טקסט ההיגד"
          maxLength={120}
          required
          disabled={disabled}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none disabled:opacity-60"
        />
        <select
          value={trait.category}
          onChange={e => onChange({ ...trait, category: e.target.value as TraitCategory })}
          required
          disabled={disabled}
          className={`bg-slate-900 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-60 ${
            trait.category ? 'border-slate-700 text-white' : 'border-amber-500/60 text-amber-300'
          }`}
        >
          <option value="" disabled>קטגוריה *</option>
          {TRAIT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="הסרת היגד"
          className="text-slate-500 hover:text-red-400 disabled:opacity-30 px-1.5 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <input
        type="text"
        value={trait.description}
        onChange={e => onChange({ ...trait, description: e.target.value })}
        placeholder="תיאור קצר (לא חובה)"
        maxLength={500}
        disabled={disabled}
        className="w-full bg-slate-900/60 border border-slate-800 focus:border-slate-600 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none disabled:opacity-60"
      />
    </div>
  )
}

/** Statement list editor: add, edit, remove and drag to reorder. Every statement needs a category. */
export default function TraitsEditor({ traits, disabled, onChange }: Props) {
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

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={traits.map(t => t.key)} strategy={verticalListSortingStrategy}>
          {traits.map((t, i) => (
            <Row
              key={t.key}
              trait={t}
              index={i}
              disabled={disabled}
              canRemove={traits.length > 1}
              onChange={next => onChange(traits.map(x => (x.key === t.key ? next : x)))}
              onRemove={() => onChange(traits.filter(x => x.key !== t.key))}
            />
          ))}
        </SortableContext>
      </DndContext>
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...traits, newTraitDraft()])}
          disabled={traits.length >= 50}
          className="self-start text-sm text-amber-400 hover:text-amber-300 font-semibold px-1 py-1 disabled:opacity-40"
        >
          + הוספת היגד
        </button>
      )}
    </div>
  )
}
