import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ExpensesComponent } from './components/expenses/expenses.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { MonthlyReportsComponent } from './components/monthly-reports/monthly-reports.component';
import { LoginComponent } from './components/auth/login.component';
import { RegisterComponent } from './components/auth/register.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password.component';
import { EmailTestComponent } from './components/auth/email-test.component';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'email-test', component: EmailTestComponent }, // Temporary debug route
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'expenses', component: ExpensesComponent, canActivate: [AuthGuard] },
  { path: 'categories', component: CategoriesComponent, canActivate: [AuthGuard] },
  { path: 'reports', component: MonthlyReportsComponent, canActivate: [AuthGuard] }
];
