import { House, Gear, Queue } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { SpliceIcon } from './SpliceIcon'

interface SidebarProps {
  currentView: 'queue' | 'settings'
  onNavigate: (view: 'queue' | 'settings') => void
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#21252b] border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 flex-shrink-0 text-purple-600 dark:text-purple-400">
            <SpliceIcon className="group-hover-trigger" />
          </div>
          <h1 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            Splice
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => onNavigate('queue')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                currentView === 'queue'
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <House className="h-5 w-5" weight={currentView === 'queue' ? 'fill' : 'regular'} />
              <span className="font-medium">Home</span>
            </button>
          </li>

          <li>
            <button
              onClick={() => onNavigate('queue')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                currentView === 'queue'
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Queue className="h-5 w-5" weight={currentView === 'queue' ? 'fill' : 'regular'} />
              <span className="font-medium">Video Queue</span>
            </button>
          </li>

          <li>
            <button
              onClick={() => onNavigate('settings')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                currentView === 'settings'
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Gear className="h-5 w-5" weight={currentView === 'settings' ? 'fill' : 'regular'} />
              <span className="font-medium">Settings</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Footer - could add user profile, version info, etc. */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Splice v1.0.0
        </p>
      </div>
    </aside>
  )
}
