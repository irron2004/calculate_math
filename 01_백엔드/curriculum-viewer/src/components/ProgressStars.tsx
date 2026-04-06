type ProgressStarsProps = {
  current: number
  total: number
  type?: 'stars' | 'circles'
}

export default function ProgressStars({ current, total, type = 'stars' }: ProgressStarsProps) {
  const filled = type === 'stars' ? '⭐' : '●'
  const empty = type === 'stars' ? '☆' : '○'

  const stars = []
  for (let i = 0; i < total; i++) {
    stars.push(
      <span
        key={i}
        className={`progress-star ${i < current ? 'progress-star-filled' : 'progress-star-empty'}`}
        aria-hidden="true"
      >
        {i < current ? filled : empty}
      </span>
    )
  }

  return (
    <div className="progress-stars" role="img" aria-label={`${current}/${total} 완료`}>
      {stars}
      <span className="progress-stars-text">{current}/{total}</span>
    </div>
  )
}
