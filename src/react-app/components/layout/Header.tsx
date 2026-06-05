import { Search, LogOut, User as UserIcon, Menu, ArrowLeftCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../ThemeToggle'
import NotificationsDropdown from '../NotificationsDropdown'

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout, isImpersonating, exitImpersonation } = useAuth()

  if (!user) return null

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm z-10 shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-4 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search system..."
            className="pl-10 w-full bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {isImpersonating && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={exitImpersonation}
            className="bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hidden sm:flex items-center"
          >
            <ArrowLeftCircle className="w-4 h-4 mr-2" />
            Exit Impersonation
          </Button>
        )}

        <NotificationsDropdown />

        <ThemeToggle />

        {isImpersonating && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={exitImpersonation}
            className="sm:hidden text-orange-600 hover:bg-orange-50"
            title="Exit Impersonation"
          >
            <ArrowLeftCircle className="w-5 h-5" />
          </Button>
        )}

        <div className="hidden sm:block h-8 w-[1px] bg-border mx-2" />

        <div className="hidden sm:flex items-center space-x-3 pl-2">
          <div className="flex flex-col items-end">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.role.replace('_', ' ')}
            </p>
          </div>
          <div className="h-9 w-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-md border border-border flex-shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              <UserIcon size={18} />
            )}
          </div>
        </div>

        <div className="sm:hidden h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-md border border-border flex-shrink-0">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <UserIcon size={16} />
          )}
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={logout}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 sm:w-5 h-4 sm:h-5" />
        </Button>
      </div>
    </header>
  )
}
