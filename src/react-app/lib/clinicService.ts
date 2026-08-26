// src/react-app/lib/clinicService.ts
//
// Thin wrappers around the clinic API. These take the app's authenticated
// fetcher (from useApi() in AuthContext) so auth/refresh/logout handling
// stays centralized, matching the convention used by Library/Librarian pages.

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export interface DispensePayload {
  student_id: number;
  medication_id: string;
  amount: number;
}

export interface ClinicStats {
  pending_meds: number;
  low_stock: number;
  total_visits: number;
}

export interface StudentSearchResult {
  student_id: string;
  name: string;
  grade: string;
  has_profile: boolean;
  critical_allergies: string[];
}

export const clinicService = {
  /** Dispense medication and log the visit */
  async dispenseMedication(api: ApiFetch, payload: DispensePayload) {
    const response = await api('/api/clinic/dispense', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  /** Fetch daily statistics for the dashboard */
  async getDashboardStats(api: ApiFetch): Promise<ClinicStats> {
    const response = await api('/api/clinic/stats');
    return response.json();
  },

  /** Search for student health profiles */
  async searchStudents(api: ApiFetch, query: string): Promise<StudentSearchResult[]> {
    const response = await api(`/api/clinic/students/search?q=${encodeURIComponent(query)}`);
    return response.json();
  },
};
