import type { IconName } from '../types'

export function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case 'bike':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="6.5" cy="17.5" r="3.5" />
          <circle cx="17.5" cy="17.5" r="3.5" />
          <path d="M10 6.5h3l4.5 7" />
          <path d="M9.5 17.5 13 10l-2.2-3.5" />
          <path d="M8.5 8.5h2.8" />
        </svg>
      )
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.8 18.4c0-2.9 2.5-5 5.2-5s5.2 2.1 5.2 5" />
          <circle cx="17.2" cy="8.8" r="2.4" />
          <path d="M16 13.7c2.3 0 4.2 1.6 4.2 4" />
        </svg>
      )
    case 'tool':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="m14.2 6.8 3 3" />
          <path d="M5 19l6.7-6.7a3.3 3.3 0 1 0 4-4L9 15l-4 4Z" />
        </svg>
      )
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      )
    case 'map':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="m3.5 6.5 5-2 7 2 5-2v13l-5 2-7-2-5 2z" />
          <path d="M8.5 4.5v13" />
          <path d="M15.5 6.5v13" />
        </svg>
      )
    case 'wallet':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M4 9.5h14.5A1.5 1.5 0 0 1 20 11v2a1.5 1.5 0 0 1-1.5 1.5H4" />
          <circle cx="16.4" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M4 19.5h16" />
          <path d="M7 17V10" />
          <path d="M12 17V5.5" />
          <path d="M17 17v-7" />
        </svg>
      )
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
    case 'support':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M4 12a8 8 0 1 1 16 0" />
          <path d="M4.5 13.5h2a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 6.5 18.5h-1A1.5 1.5 0 0 1 4 17v-3.5Z" />
          <path d="M16 16.5h2.5A1.5 1.5 0 0 0 20 15v-1.5A1.5 1.5 0 0 0 18.5 12H18" />
          <path d="M12 20h2.5" />
        </svg>
      )
    case 'ticket':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v4a2 2 0 0 0 0 4v4H6.5A2.5 2.5 0 0 1 4 14.5z" />
          <path d="M9 9h6" />
          <path d="M9 13h3" />
        </svg>
      )
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v5l3 2" />
        </svg>
      )
    case 'logout':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H4" />
        </svg>
      )
    case 'chevron-left':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      )
    case 'chevron-right':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )
    default:
      return null
  }
}
