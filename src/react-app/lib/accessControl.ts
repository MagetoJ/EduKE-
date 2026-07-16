export type Role = 'super_admin' | 'admin' | 'teacher' | 'parent' | 'student' | 'registrar' | 'exam_officer' | 'hod' | 'timetable_manager' | 'transport_manager' | 'class_teacher' | 'boarding_master' | 'cbc_coordinator' | 'hr_manager' | 'admission_officer' | 'nurse';

export const routeRoles: { path: string; roles: Role[] }[] = [
  { path: '/dashboard/schools', roles: ['super_admin'] },
  { path: '/dashboard/school-admins', roles: ['super_admin'] },
  { path: '/dashboard/subscriptions', roles: ['super_admin'] },
  { path: '/dashboard/platform-admin', roles: ['super_admin'] },
  { path: '/dashboard/students', roles: ['admin', 'teacher', 'registrar', 'exam_officer', 'hod', 'admission_officer', 'class_teacher'] },
  { path: '/dashboard/staff', roles: ['admin', 'registrar', 'hod', 'hr_manager'] },
  { path: '/dashboard/academics', roles: ['admin', 'teacher', 'exam_officer', 'hod', 'cbc_coordinator', 'class_teacher'] },
  { path: '/dashboard/progress', roles: ['parent', 'student'] },
  { path: '/dashboard/parent', roles: ['parent'] },
  { path: '/dashboard/student-dashboard', roles: ['student'] },
  { path: '/dashboard/teacher-dashboard', roles: ['teacher', 'hod', 'class_teacher'] },
  { path: '/dashboard/timetable-manager', roles: ['timetable_manager', 'admin'] },
  { path: '/dashboard/timetable', roles: ['admin', 'teacher', 'parent', 'student', 'timetable_manager', 'registrar', 'hod'] },
  { path: '/dashboard/communications', roles: ['admin', 'teacher', 'parent', 'registrar', 'hod', 'hr_manager', 'admission_officer', 'nurse'] },
  { path: '/dashboard/fees', roles: ['admin', 'parent', 'student', 'registrar', 'super_admin'] },
  { path: '/dashboard/leave', roles: ['admin', 'teacher', 'hod', 'hr_manager'] },
  { path: '/dashboard/reports', roles: ['admin', 'super_admin', 'registrar', 'exam_officer', 'hod', 'hr_manager'] },
  { path: '/dashboard/cbc', roles: ['admin', 'teacher', 'hod', 'cbc_coordinator'] },
  { path: '/dashboard/transport', roles: ['admin', 'transport_manager'] },
  {path: '/dashboard/subjects', roles: ['admin', 'registrar', 'hod', 'super_admin'] },
  { path: '/dashboard/boarding', roles: ['admin', 'registrar', 'boarding_master'] },
  { path: '/dashboard/curriculum-assessment', roles: ['admin', 'teacher', 'exam_officer', 'hod', 'cbc_coordinator'] },
  { path: '/dashboard/settings', roles: ['admin', 'super_admin'] },
  { path: '/dashboard/class-teacher', roles: ['class_teacher', 'admin'] },
  { path: '/dashboard/hod', roles: ['hod', 'admin'] }

];

export function routeAllowsRole(pathname: string, roles: string[]): boolean {
  const candidates = routeRoles
    .filter(r => pathname === r.path || pathname.startsWith(r.path + '/'))
    .sort((a, b) => b.path.length - a.path.length);

  if (candidates.length === 0) return true;
  return candidates[0].roles.some(allowed => roles.includes(allowed));
}
export const ROLE_PERMISSIONS = {
  hod: [
    'view_dashboard',
    'view_reports',
    'manage_inventory',
    'issue_assets'
  ],
};

export const CURRICULUM_PERMISSIONS = {
  MANAGE_MASTER_TAXONOMY: ['super_admin'],
  MANAGE_SCHOOL_OFFERINGS: ['admin', 'hod', 'registrar'],
  RECORD_COMPETENCY_GRADES: ['teacher', 'class_teacher', 'cbc_coordinator'],
  VIEW_CBC_SLIPS: ['admin', 'teacher', 'parent', 'student']
};

export function hasCurriculumAccess(userRole: string, action: keyof typeof CURRICULUM_PERMISSIONS): boolean {
  const allowedRoles = CURRICULUM_PERMISSIONS[action];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
}