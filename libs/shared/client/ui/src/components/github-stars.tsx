"use client"

import { useEffect, useState } from "react"
import { Github, Star } from "lucide-react"

interface GitHubStarsProps {
  repo: string
  className?: string
}

export function GitHubStars({ repo, className }: GitHubStarsProps) {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count)
        }
      })
      .catch(() => {
        // Silently fail - we'll just not show the count
      })
  }, [repo])

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <Github className="h-4 w-4" />
      {stars !== null && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <Star className="h-3 w-3 fill-current" />
          {formatStars(stars)}
        </span>
      )}
    </a>
  )
}
