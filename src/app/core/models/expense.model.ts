export interface Expense {
  id: string;
  amount: number;
  date: string; // ISO string
  categoryId: string;
  description?: string;
  paymentMethod?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  location?: string;
  receiptNumber?: string;
} 