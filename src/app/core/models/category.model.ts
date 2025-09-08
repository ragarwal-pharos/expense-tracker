export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  userId?: string; // Added for Firebase user isolation
} 