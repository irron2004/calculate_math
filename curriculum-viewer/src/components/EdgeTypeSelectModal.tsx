import { useEffect, useState } from 'react'
import type { SkillGraphEdgeType } from '../lib/skillGraph/schema'

export type EdgeTypeOption = {
  value: SkillGraphEdgeType
  label: string
  description?: string
}

export type EdgeTypeSelectModalProps = {
  isOpen: boolean
  options: EdgeTypeOption[]
  initialValue: SkillGraphEdgeType
  onConfirm: (value: SkillGraphEdgeType) => void
  onCancel: () => void
}

export default function EdgeTypeSelectModal({
  isOpen,
  options,
  initialValue,
  onConfirm,
  onCancel
}: EdgeTypeSelectModalProps) {
  const [selected, setSelected] = useState<SkillGraphEdgeType>(initialValue)

  useEffect(() => {
    if (isOpen) {
      setSelected(initialValue)
    }
  }, [initialValue, isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="엣지 타입 선택">
      <div className="modal-content">
        <h2>엣지 타입 선택</h2>
        <p className="muted">연결할 타입을 선택하세요.</p>
        <div className="edge-type-options">
          {options.map((option) => (
            <label key={option.value} className="edge-type-option">
              <input
                type="radio"
                name="edge-type"
                value={option.value}
                checked={selected === option.value}
                onChange={() => setSelected(option.value)}
              />
              <span className="mono">{option.label}</span>
              {option.description ? <span className="muted">{option.description}</span> : null}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-primary" onClick={() => onConfirm(selected)}>
            선택
          </button>
          <button type="button" className="button button-ghost" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
