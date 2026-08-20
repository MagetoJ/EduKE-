// src/react-app/hooks/useFinance.ts
/* cspell:disable M-PESA mpesa */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- API Response Interfaces ---
export interface FeeStatement {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  dueDate: string;
  breakdown: Array<{
    id: string;
    category: 'Tuition' | 'Boarding' | 'Transport' | 'Activity' | 'Other';
    title: string;
    amountDue: number;
    amountPaid: number;
  }>;
}

export interface TransactionRecord {
  id: string;
  receiptNumber: string;
  date: string;
  amount: number;
  paymentMethod: 'M-PESA' | 'Bank Transfer' | 'Cash';
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

export interface STKPushRequest {
  studentId: string;
  phoneNumber: string;
  amount: number;
}

export interface STKPushResponse {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseDescription: string;
}

export interface PaymentStatusResponse {
  checkoutRequestId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  receiptNumber?: string;
  failureReason?: string;
}

// --- API Helper Functions ---
const API_BASE_URL = '/api/v1/payments';

async function fetchFeeStatement(studentId: string): Promise<FeeStatement> {
  const response = await fetch(`${API_BASE_URL}/students/${studentId}/statement`);
  if (!response.ok) {
    throw new Error('Failed to fetch fee statement');
  }
  return response.json();
}

async function fetchPaymentHistory(
  studentId: string, 
  searchQuery?: string
): Promise<TransactionRecord[]> {
  const url = new URL(`${API_BASE_URL}/students/${studentId}/history`, window.location.origin);
  if (searchQuery) {
    url.searchParams.append('query', searchQuery);
  }
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch payment history');
  }
  return response.json();
}

async function initiateSTKPush(payload: STKPushRequest): Promise<STKPushResponse> {
  const response = await fetch(`${API_BASE_URL}/mpesa/stk-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Failed to initiate M-PESA payment');
  }
  return response.json();
}

async function checkPaymentStatus(checkoutRequestId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/mpesa/status/${checkoutRequestId}`);
  if (!response.ok) {
    throw new Error('Failed to check payment status');
  }
  return response.json();
}

// --- TanStack Custom Hooks ---

/**
 * Hook to fetch fee statement summary & breakdown items.
 */
export function useStudentFeeSummary(studentId: string) {
  return useQuery({
    queryKey: ['feeSummary', studentId],
    queryFn: () => fetchFeeStatement(studentId),
    enabled: Boolean(studentId),
    staleTime: 1000 * 60 * 5, // Cache summary for 5 minutes
  });
}

/**
 * Hook to fetch student payment ledger history.
 */
export function usePaymentHistory(studentId: string, searchQuery: string = '') {
  return useQuery({
    queryKey: ['paymentHistory', studentId, searchQuery],
    queryFn: () => fetchPaymentHistory(studentId, searchQuery),
    enabled: Boolean(studentId),
    staleTime: 1000 * 60 * 2, // Cache history for 2 minutes
  });
}

/**
 * Mutation hook to initiate an M-PESA STK Push transaction.
 */
export function useInitiateSTKPush() {
  return useMutation({
    mutationFn: initiateSTKPush,
  });
}

/**
 * Hook to poll status of an active M-PESA checkout session every 3 seconds.
 */
export function usePaymentStatus(checkoutRequestId: string | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['paymentStatus', checkoutRequestId],
    queryFn: () => checkPaymentStatus(checkoutRequestId!),
    enabled: Boolean(checkoutRequestId),
    refetchInterval: (query: any) => {
      const data = query.state.data as PaymentStatusResponse | undefined;
      // Continue polling every 3 seconds while PENDING
      if (!data || data.status === 'PENDING') {
        return 3000;
      }
      return false; // Stop polling once COMPLETED or FAILED
    },
    meta: {
      onSuccess: (data: PaymentStatusResponse) => {
        if (data.status === 'COMPLETED') {
          queryClient.invalidateQueries({ queryKey: ['feeSummary'] });
          queryClient.invalidateQueries({ queryKey: ['paymentHistory'] });
        }
      },
    },
  });
}