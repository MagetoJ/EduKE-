import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  UserCheck, 
  FileText, 
  CreditCard, 
  Menu, 
  X, 
  Zap, 
  Bus, 
  Home, 
  TrendingUp, 
  School,
  Building2,
  DollarSign,
  Clock,
  BarChart3,
  MessageSquare,
  Shield,
  Settings
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth, UserRole } from '../../contexts/AuthContext'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

interface NavGroup {
  category: string
  items: NavItem[]
}

// Grouped exactly according to your handwritten wireframe blueprint
const navGroups: NavGroup[] = [
  {
    category: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['super_admin', 'admin', 'teacher', 'parent', 'student', 'registrar', 'exam_officer', 'hod', 'timetable_manager', 'transport_manager', 'class_teacher', 'boarding_master', 'cbc_coordinator', 'hr_manager', 'admission_officer', 'nurse']
      },
      {
        title: 'My Progress',
        href: '/dashboard/progress',
        icon: BarChart3,
        roles: ['parent', 'student']
      },
      {
        title: 'Parent Portal',
        href: '/dashboard/parent',
        icon: Users,
        roles: ['parent']
      },
      {
        title: 'Teacher Portal',
        href: '/dashboard/teacher-dashboard',
        icon: BookOpen,
        roles: ['teacher', 'hod', 'class_teacher']
      },
      {
        title: 'Timetable Dashboard',
        href: '/dashboard/timetable-manager',
        icon: Calendar,
        roles: ['timetable_manager', 'admin']
      }
    ]
  },
  {
    category: 'Operations',
    items: [
      {
        title: 'Students',
        href: '/dashboard/students',
        icon: Users,
        roles: ['admin', 'teacher', 'registrar', 'exam_officer', 'hod', 'admission_officer', 'class_teacher']
      },
      {
        title: 'Staff',
        href: '/dashboard/staff',
        icon: UserCheck,
        roles: ['admin', 'registrar', 'hod', 'hr_manager']
      },
      {
        title: 'Timetable',
        href: '/dashboard/timetable',
        icon: Calendar,
        roles: ['admin', 'teacher', 'parent', 'student', 'timetable_manager', 'registrar', 'hod']
      },
      {
        title: 'Attendance',
        href: '/dashboard/attendance',
        icon: UserCheck,
        roles: ['teacher', 'hod', 'class_teacher']
      },
      {
        title: 'Leave Management',
        href: '/dashboard/leave',
        icon: Clock,
        roles: ['admin', 'teacher', 'hod', 'hr_manager']
      },
      {
        title: 'Communications',
        href: '/dashboard/communications',
        icon: MessageSquare,
        roles: ['admin', 'teacher', 'parent', 'registrar', 'hod', 'hr_manager', 'admission_officer', 'nurse']
      }
    ]
  },
  {
    category: 'Academics',
    items: [
      {
        title: 'CBC Assessment',
        href: '/dashboard/cbc',
        icon: Zap,
        roles: ['admin', 'teacher', 'hod', 'cbc_coordinator']
      },
      {
        title: 'KNEC & Exams',
        href: '/dashboard/academics',
        icon: BookOpen,
        roles: ['admin', 'teacher', 'exam_officer', 'hod', 'cbc_coordinator', 'class_teacher']
      },
      {
        title: 'Curriculum Assessment',
        href: '/dashboard/curriculum-assessment',
        icon: TrendingUp,
        roles: ['admin', 'teacher', 'exam_officer', 'hod', 'cbc_coordinator']
      },
      {
        title: 'Lesson Planner',
        href: '/dashboard/student-dashboard', // mapped to discipline/lesson view
        icon: FileText,
        roles: ['student', 'teacher', 'admin', 'hod']
      },
      {
        title: 'Subjects',
        href: '/dashboard/subjects',
        icon: BookOpen,
        roles: ['admin', 'registrar', 'hod']
      },
      {
        title: 'Departments',
        href: '/dashboard/departments',
        icon: Building2,
        roles: ['admin', 'super_admin']
      }
    ]
  },
  {
    category: 'Logistics',
    items: [
      {
        title: 'Transport',
        href: '/dashboard/transport',
        icon: Bus,
        roles: ['admin', 'transport_manager']
      },
      {
        title: 'Boarding',
        href: '/dashboard/boarding',
        icon: Home,
        roles: ['admin', 'registrar', 'boarding_master']
      },
      {
        title: 'Fees & Billing',
        href: '/dashboard/fees',
        icon: DollarSign,
        roles: ['admin', 'parent', 'student', 'registrar', 'super_admin']
      },
      {
        title: 'Reports',
        href: '/dashboard/reports',
        icon: BarChart3,
        roles: ['admin', 'super_admin', 'registrar', 'exam_officer', 'hod', 'hr_manager']
      }
    ]
  },
  {
    category: 'System Admin',
    items: [
      {
        title: 'Schools',
        href: '/dashboard/schools',
        icon: School,
        roles: ['super_admin']
      },
      {
        title: 'School Admins',
        href: '/dashboard/school-admins',
        icon: UserCheck,
        roles: ['super_admin']
      },
      {
        title: 'Subscriptions',
        href: '/dashboard/subscriptions',
        icon: CreditCard,
        roles: ['super_admin']
      },
      {
        title: 'Platform Admin',
        href: '/dashboard/platform-admin',
        icon: Shield,
        roles: ['super_admin']
      },
      {
        title: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        roles: ['admin', 'super_admin']
      },
      {
        title: 'Library',
        href: '/dashboard/library',
        icon: BookOpen,
        roles: ['super_admin', 'admin', 'librarian', 'teacher', 'student', 'parent']
      }
    ]
  }
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()

  if (!user) return null

  const effectiveRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role]

  const NavContent = () => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border bg-card shrink-0">
        <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center mr-3 shadow-sm">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-bold text-foreground text-lg tracking-tight">EduKE</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {navGroups.map((group) => {
          // Filter group items according to logged-in user role
          const filteredGroupItems = group.items.filter(item =>
            item.roles.some(role => effectiveRoles.includes(role))
          )

          if (filteredGroupItems.length === 0) return null

          return (
            <div key={group.category} className="space-y-1">
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
                {group.category}
              </h3>

              {filteredGroupItems.map((item) => {
                const Icon = item.icon
                const isActive = item.href === '/dashboard' 
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-sm font-medium group',
                      isActive 
                        ? 'bg-primary/10 text-primary shadow-sm border border-primary/20 font-semibold' 
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className={cn(
                      'w-4 h-4 transition-colors shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                    )} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border bg-muted/30 shrink-0">
        {user.schoolName && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <School className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate font-medium">{user.schoolName}</span>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      <aside className="w-64 bg-card border-r border-border flex-col hidden md:flex shrink-0 shadow-sm h-screen sticky top-0">
        <NavContent />
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />
        </div>
      )}

      <div 
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-card flex flex-col shadow-lg z-50 md:hidden transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </div>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-foreground hover:bg-accent transition-colors"
      aria-label="Toggle menu"
    >
      <Menu className="w-6 h-6" />
    </button>
  )
}

export function MobileMenuClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center p-2 rounded-md text-foreground hover:bg-accent transition-colors"
      aria-label="Close menu"
    >
      <X className="w-6 h-6" />
    </button>
  )
}