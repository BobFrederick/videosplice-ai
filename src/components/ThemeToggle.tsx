import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  console.log('🎨 ThemeToggle render - current theme:', theme)

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        console.log('🔄 Theme toggle clicked, current theme:', theme)
        toggleTheme()
      }}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  )
}
