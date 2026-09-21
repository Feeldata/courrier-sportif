import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string
  title: string
  description?: string
  aside?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {aside ? <div className="page-header-aside">{aside}</div> : null}
    </header>
  )
}

export function SectionHeader({ title, link }: { title: string; link?: { href: string; label: string } }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {link ? <Link href={link.href}>{link.label}</Link> : null}
    </div>
  )
}
