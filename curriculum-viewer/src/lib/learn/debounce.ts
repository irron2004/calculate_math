export type DebouncedFunction<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void
}

export function debounce<T extends (...args: any[]) => void>(
  callback: T,
  delayMs: number
): DebouncedFunction<T> {
  let timer: number | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timer !== null) {
      window.clearTimeout(timer)
    }
    timer = window.setTimeout(() => {
      timer = null
      callback(...args)
    }, delayMs)
  }) as DebouncedFunction<T>

  debounced.cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}
