import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const FOCUS_QUERY_PARAM = 'focus'

type SetFocusOptions = {
  replace?: boolean
}

export function useFocusNodeId(): {
  focusNodeId: string | null
  setFocusNodeId: (nodeId: string | null, options?: SetFocusOptions) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const raw = (searchParams.get(FOCUS_QUERY_PARAM) ?? '').trim()
  const focusNodeId = raw.length > 0 ? raw : null

  const setFocusNodeId = useCallback(
    (nodeId: string | null, options?: SetFocusOptions) => {
      const next = new URLSearchParams(searchParams)
      const normalized = (nodeId ?? '').trim()

      if (normalized.length === 0) {
        next.delete(FOCUS_QUERY_PARAM)
      } else {
        next.set(FOCUS_QUERY_PARAM, normalized)
      }

      setSearchParams(next, { replace: options?.replace ?? false })
    },
    [searchParams, setSearchParams]
  )

  return { focusNodeId, setFocusNodeId }
}

