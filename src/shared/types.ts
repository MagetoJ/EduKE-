/**
 * Types shared between the client and server go here.
 *
 * For example, we can add zod schemas for API input validation, and derive types from them:
 *
 * import z from "zod";
 *
 * export const TodoSchema = z.object({
 *   id: z.number(),
 *   name: z.string(),
 *   completed: z.number().int(), // 0 or 1
 * })
 *
 * export type TodoType = z.infer<typeof TodoSchema>;
 */

export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'teacher' 
  | 'parent' 
  | 'student' 
  | 'registrar' 
  | 'timetable_manager' 
  | 'class_teacher' 
  | 'boarding_master' 
  | 'transport_manager' 
  | 'exam_officer' 
  | 'cbc_coordinator' 
  | 'hod' 
  | 'hr_manager' 
  | 'admission_officer' 
  | 'nurse';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  avatar?: string;
  must_change_password?: boolean;
  // System configurations derived from Option Selected in School Registration
  isSpecialNeeds?: boolean;
  disabilityCategory?: 'hearing_impaired' | 'visual_impaired' | 'physical_mobility';
}

export interface School {
  id: string;
  name: string;
  is_special_needs: boolean;
  disability_category?: 'hearing_impaired' | 'visual_impaired' | 'physical_mobility';
}

export interface StudentDeafProfile {
  id: string;
  student_id: string;
  ksl_proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'native';
  hearing_loss_degree_left?: string;
  hearing_loss_degree_right?: string;
  assistive_device_used?: string;
  preferred_communication_mode: 'KSL' | 'Total Communication' | 'Oral';
  updated_at: string;
}

export interface StudentIEP {
  id: string;
  student_id: string;
  academic_year: string;
  term: string;
  current_performance_summary: string;
  annual_goals: string[];
  accommodations_provided: string[];
  iep_coordinator_id: string;
  status: 'active' | 'reviewed' | 'archived';
}