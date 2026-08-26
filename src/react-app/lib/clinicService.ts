// src/react-app/lib/clinicService.ts

// Adjust this base URL based on your environment config
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper to get the auth token (assuming you store it in localStorage)
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface DispensePayload {
  student_id: string;
  nurse_id: string;
  medication_id: string;
  amount: number;
}

export const clinicService = {
  /**
   * Dispense medication and log the visit
   */
  async dispenseMedication(payload: DispensePayload) {
    const response = await fetch(`${API_BASE_URL}/api/clinic/dispense`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to dispense medication');
    }

    return response.json();
  },

  /**
   * Fetch daily statistics for the dashboard
   */
  async getDashboardStats() {
    const response = await fetch(`${API_BASE_URL}/api/clinic/stats`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch clinic stats');
    return response.json();
  },

  /**
   * Search for student health profiles
   */
  async searchStudents(query: string) {
    const response = await fetch(`${API_BASE_URL}/api/clinic/students/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to search students');
    return response.json();
  }
};