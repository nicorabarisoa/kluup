'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

// Compact language switcher (FR / EN …).
export function LangSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  const locales = Object.keys(dictionaries) as Locale[]
  return (
    <div className={`flex gap-1 ${className}`}>
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className="text-xs font-bold px-2 py-1 rounded-lg"
          style={{
            background: l === locale ? '#fff' : '#1A1A1A',
            color: l === locale ? '#0D0D0D' : '#888',
            border: '1px solid #252525',
            fontFamily: 'var(--font-body)',
          }}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  )
}
