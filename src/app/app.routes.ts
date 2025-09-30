import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  
  // Auth routes (eagerly loaded for faster access)
  { 
    path: 'login', 
    loadComponent: () => import('./components/auth/login.component').then(m => m.LoginComponent)
  },
  { 
    path: 'register', 
    loadComponent: () => import('./components/auth/register.component').then(m => m.RegisterComponent)
  },
  { 
    path: 'forgot-password', 
    loadComponent: () => import('./components/auth/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  { 
    path: 'reset-password', 
    loadComponent: () => import('./components/auth/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  { 
    path: 'email-test', 
    loadComponent: () => import('./components/auth/email-test.component').then(m => m.EmailTestComponent)
  },
  
  // Main app routes (lazy loaded for better performance)
  { 
    path: 'dashboard', 
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent), 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'expenses', 
    loadComponent: () => import('./components/expenses/expenses.component').then(m => m.ExpensesComponent), 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'categories', 
    loadComponent: () => import('./components/categories/categories.component').then(m => m.CategoriesComponent), 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'reports', 
    loadComponent: () => import('./components/monthly-reports/monthly-reports.component').then(m => m.MonthlyReportsComponent), 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'analysis', 
    loadComponent: () => import('./components/expense-analysis/expense-analysis.component').then(m => m.ExpenseAnalysisComponent), 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'mapper', 
    loadComponent: () => import('./components/expense-category-mapper/expense-category-mapper.component').then(m => m.ExpenseCategoryMapperComponent), 
    canActivate: [AuthGuard] 
  },
  
  // Wildcard route for 404
  { path: '**', redirectTo: '/dashboard' }
];
