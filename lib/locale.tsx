'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { dictionaries, defaultLocale, localeNames, type Dict, type Locale } from '@/lib/i18n'

type Ctx = { locale: Locale; setLocale: (l: Locale) => void }

const LocaleContext = createContext<Ctx>({ locale: defaultLocale, setLocale: () => {} })

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  // Detect on the client (after hydration): saved choice first, else browser language.
  useEffect(() => {
    const stored = localStorage.getItem('locale')
    if (stored && stored in dictionaries) { setLocaleState(stored as Locale); return }
    const nav = (navigator.language || '').slice(0, 2).toLowerCase()
    if (nav in dictionaries) setLocaleState(nav as Locale)
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    try { localStorage.setItem('locale', l) } catch { /* ignore */ }
  }

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}

export function useLocale(): Ctx {
  return useContext(LocaleContext)
}

// The active translation dictionary.
export function useT(): Dict {
  return dictionaries[useContext(LocaleContext).locale]
}

// Compact dropdown language switcher — works with any number of languages.
export function LangSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const locales = Object.keys(dictionaries) as Locale[]

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }} className={className}>
      {/* Trigger pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl"
        style={{
          background: '#1A1A1A',
          border: '1px solid #252525',
          color: '#fff',
          fontFamily: 'var(--font-body)',
        }}
      >
        {locale.toUpperCase()}
        <span style={{ color: '#666', fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: '#1A1A1A', border: '1px solid #252525',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 200, minWidth: 130,
          }}
        >
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false) }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium"
              style={{
                color: l === locale ? '#fff' : '#888',
                background: l === locale ? '#252525' : 'transparent',
                fontFamily: 'var(--font-body)',
                textAlign: 'left',
              }}
            >
              {localeNames[l]}
              {l === locale && (
                <span style={{ color: '#FF3C6F', fontSize: 12 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
