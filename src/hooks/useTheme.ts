import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light')

  useEffect(() => {
    const root = document.documentElement
    
    console.log('🎨 Theme effect running, theme:', theme)
    console.log('🎨 HTML classList before:', root.classList.toString())
    
    // Force remove dark class first
    root.classList.remove('dark')
    
    // Then add it back if needed
    if (theme === 'dark') {
      root.classList.add('dark')
    }
    
    console.log('🎨 HTML classList after:', root.classList.toString())
  }, [theme])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    console.log('🔄 Toggling theme from', theme, 'to', newTheme)
    setTheme(newTheme)
  }

  return { theme, setTheme, toggleTheme }
}
