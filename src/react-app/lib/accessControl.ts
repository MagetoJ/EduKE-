export type SystemRole =
  | 'teacher'
  | 'class_teacher'
  | 'registrar'
  | 'exam_officer'
  | 'hod'
  | 'timetable_manager'
  | 'transport_manager'
  | 'boarding_master'
  | 'cbc_coordinator'
  | 'hr_manager'
  | 'admission_officer'
  | 'nurse'
  | 'administrator'
  | 'counselor'
  | 'librarian'
  | 'parent'
  | 'student';

export interface NavItem {
  title: string;
  href: string;
  roles: SystemRole[];
}

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  { title: 'Class Rosters & Attendance', href: '/teacher/dashboard', roles: ['teacher', 'class_teacher', 'administrator'] },
  { title: 'Class Reports & Conduct', href: '/class-teacher/reports', roles: ['class_teacher', 'administrator'] },
  { title: 'Transcripts & Archival Logs', href: '/registrar/records', roles: ['registrar', 'administrator'] },
  { title: 'Exam Scheduling & Mark Entry', href: '/exams/manage', roles: ['exam_officer', 'administrator'] },
  { title: 'HOD Department Analytics', href: '/hod/analytics', roles: ['hod', 'administrator'] },
  { title: 'Timetable Scheduling Matrix', href: '/timetable/builder', roles: ['timetable_manager', 'administrator'] },
  { title: 'Fleet & Bus Routes', href: '/transport/routes', roles: ['transport_manager', 'administrator'] },
  { title: 'Dormitories & Leave/Exeat', href: '/boarding/dorms', roles: ['boarding_master', 'administrator'] },
  { title: 'CBC Rubric & Portfolios', href: '/cbc/assessments', roles: ['cbc_coordinator', 'teacher', 'administrator'] },
  { title: 'Payroll & HR Records', href: '/hr/staff', roles: ['hr_manager', 'administrator'] },
  { title: 'Online Admission Portal', href: '/admissions/applications', roles: ['admission_officer', 'administrator'] },
  { title: 'Clinic Logs & Allergies', href: '/clinic/visits', roles: ['nurse', 'administrator'] },
  { title: 'Confidential Counseling Logs', href: '/counseling/sessions', roles: ['counselor', 'administrator'] },
  { title: 'Library Book Catalog (OPAC)', href: '/library/catalog', roles: ['librarian', 'teacher', 'student', 'administrator'] },
  { title: 'Parent Portal', href: '/parent-dashboard', roles: ['parent', 'administrator'] },
  { title: 'Student Dashboard', href: '/student-dashboard', roles: ['student', 'administrator'] },
];

export function canUserAccessRoute(userRoles: string[], allowedRoles: SystemRole[]): boolean {
  if (userRoles.includes('administrator') || userRoles.includes('super_admin')) return true;
  return userRoles.some((r) => allowedRoles.includes(r as SystemRole));
}