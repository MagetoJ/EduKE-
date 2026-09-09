import { createContext } from 'react'

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'parent' | 'student' | 'registrar' | 'timetable_manager' | 'class_teacher' | 'boarding_master' | 'transport_manager' | 'exam_officer' | 'cbc_coordinator' | 'hod' | 'hr_manager' | 'admission_officer' | 'nurse' | 'librarian'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  roles: UserRole[]
  schoolId?: string
  schoolName?: string
  schoolCurriculum?: string
  avatar?: string
  must_change_password?: boolean
  isSpecialNeeds?: boolean
  disabilityCategory?: 'hearing_impaired' | 'visual_impaired' | 'physical_mobility'
}

export interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
  login: (email: string, password: string, remember?: boolean) => Promise<string | void>
  logout: () => void
  isLoading: boolean
  token: string | null
  isImpersonating: boolean
  refreshSession: () => Promise<string | null>
  impersonate: (token: string, user: User) => void
  exitImpersonation: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
