import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ExpensesComponent } from './components/expenses/expenses.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { MonthlyReportsComponent } from './components/monthly-reports/monthly-reports.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'expenses', component: ExpensesComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'reports', component: MonthlyReportsComponent }
];
