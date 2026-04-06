import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_FILES = 3
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.webp'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type ImagePreview = {
  id: string
  file: File
  url: string
  error?: string
}

type ImageUploaderProps = {
  value: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

export default function ImageUploader({ value, onChange, disabled }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<ImagePreview[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewsRef = useRef<ImagePreview[]>([])

  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  useEffect(() => {
    return () => {
      for (const preview of previewsRef.current) {
        if (preview.url) {
          URL.revokeObjectURL(preview.url)
        }
      }
    }
  }, [])

  const addFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles || newFiles.length === 0) return

      const currentCount = value.length
      const availableSlots = MAX_FILES - currentCount

      if (availableSlots <= 0) {
        return
      }

      const filesToAdd = Array.from(newFiles).slice(0, availableSlots)
      const newPreviews: ImagePreview[] = []
      const validFiles: File[] = []

      for (const file of filesToAdd) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        let error: string | undefined

        if (!ALLOWED_TYPES.includes(file.type)) {
          error = '지원하지 않는 파일 형식입니다.'
        } else if (file.size > MAX_FILE_SIZE_BYTES) {
          error = `파일 크기가 5MB를 초과합니다. (${formatFileSize(file.size)})`
        }

        if (error) {
          newPreviews.push({ id, file, url: '', error })
        } else {
          const url = URL.createObjectURL(file)
          newPreviews.push({ id, file, url })
          validFiles.push(file)
        }
      }

      setPreviews((prev) => [...prev, ...newPreviews])
      onChange([...value, ...validFiles])
    },
    [onChange, value]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(e.target.files)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [addFiles]
  )

  const handleRemove = useCallback(
    (previewId: string) => {
      const previewToRemove = previews.find((p) => p.id === previewId)
      if (!previewToRemove) return

      if (previewToRemove.url) {
        URL.revokeObjectURL(previewToRemove.url)
      }

      setPreviews((prev) => prev.filter((p) => p.id !== previewId))

      if (!previewToRemove.error) {
        onChange(value.filter((f) => f !== previewToRemove.file))
      }
    },
    [onChange, previews, value]
  )

  const canAddMore = value.length < MAX_FILES

  return (
    <div className="image-uploader">
      <div className="image-uploader-header">
        <span>
          첨부 이미지 ({value.length}/{MAX_FILES})
        </span>
        <span className="muted">최대 5MB, jpg/png/webp</span>
      </div>

      {previews.length > 0 && (
        <div className="image-uploader-previews">
          {previews.map((preview) => (
            <div
              key={preview.id}
              className={`image-preview ${preview.error ? 'image-preview--error' : ''}`}
            >
              {preview.url ? (
                <img src={preview.url} alt={preview.file.name} />
              ) : (
                <div className="image-preview-placeholder" />
              )}
              <div className="image-preview-info">
                <span className="image-preview-name">{preview.file.name}</span>
                <span className="image-preview-size">{formatFileSize(preview.file.size)}</span>
                {preview.error && <span className="image-preview-error">{preview.error}</span>}
              </div>
              <button
                type="button"
                className="image-preview-remove"
                onClick={() => handleRemove(preview.id)}
                disabled={disabled}
                aria-label="삭제"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <div className="image-uploader-input">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            multiple
            onChange={handleFileChange}
            disabled={disabled}
            id="image-upload-input"
          />
          <label htmlFor="image-upload-input" className="button button-ghost">
            이미지 추가
          </label>
        </div>
      )}
    </div>
  )
}
