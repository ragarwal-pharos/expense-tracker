import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DefaultCategoriesService } from '../../core/services/default-categories.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <div class="register-header">
          <div class="brand">
            <span class="brand-icon">💰</span>
            <h1 class="brand-title">Expense Tracker</h1>
          </div>
          <p class="register-subtitle">Create your account to start tracking expenses</p>
        </div>

        <form (ngSubmit)="register()" #registerForm="ngForm" class="register-form">
          <div class="form-group">
            <label for="displayName" class="form-label">Full Name</label>
            <input 
              type="text" 
              id="displayName"
              name="displayName"
              [(ngModel)]="displayName" 
              required
              class="form-control"
              placeholder="Enter your full name">
          </div>

          <div class="form-group">
            <label for="email" class="form-label">Email</label>
            <input 
              type="email" 
              id="email"
              name="email"
              [(ngModel)]="email" 
              required
              class="form-control"
              placeholder="Enter your email">
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Password</label>
            <input 
              type="password" 
              id="password"
              name="password"
              [(ngModel)]="password" 
              required
              minlength="6"
              class="form-control"
              placeholder="Enter your password (min 6 characters)">
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">Confirm Password</label>
            <input 
              type="password" 
              id="confirmPassword"
              name="confirmPassword"
              [(ngModel)]="confirmPassword" 
              required
              class="form-control"
              placeholder="Confirm your password">
          </div>

          <div class="form-actions">
            <button 
              type="submit" 
              class="btn-primary"
              [disabled]="!registerForm.form.valid || loading || !passwordsMatch()">
              <span *ngIf="loading" class="loading-spinner">⏳</span>
              <span *ngIf="!loading">Create Account</span>
            </button>
          </div>
        </form>

        <div class="login-link">
          <p>Already have an account? <a (click)="goToLogin()" class="link">Sign in</a></p>
        </div>

        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .register-card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }

    .register-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .brand-icon {
      font-size: 2rem;
    }

    .brand-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #333;
      margin: 0;
    }

    .register-subtitle {
      color: #666;
      margin: 0;
      font-size: 1rem;
    }

    .register-form {
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-weight: 600;
      color: #333;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }

    .form-control {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e9ecef;
      border-radius: 12px;
      font-size: 1rem;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .form-control:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-control.ng-invalid.ng-touched {
      border-color: #dc3545;
    }

    .form-actions {
      margin-top: 2rem;
    }

    .btn-primary {
      width: 100%;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }



    .login-link {
      text-align: center;
      margin-top: 1rem;
    }

    .login-link p {
      color: #666;
      margin: 0;
    }

    .link {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      cursor: pointer;
    }

    .link:hover {
      text-decoration: underline;
    }

    .error-message {
      background: #fee;
      color: #c33;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      text-align: center;
      border: 1px solid #fcc;
    }

    @media (max-width: 480px) {
      .register-card {
        padding: 2rem 1.5rem;
      }
      
      .brand-title {
        font-size: 1.5rem;
      }
    }
  `]
})
export class RegisterComponent {
  displayName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  loading: boolean = false;
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private defaultCategoriesService: DefaultCategoriesService
  ) {}

  async register() {
    if (!this.displayName || !this.email || !this.password || !this.confirmPassword) {
      this.error = 'Please fill in all fields';
      return;
    }

    if (!this.passwordsMatch()) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters long';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.authService.register(this.email, this.password, this.displayName);
      // Create default categories for new user
      await this.defaultCategoriesService.createDefaultCategories();
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.error = this.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }



  goToLogin() {
    this.router.navigate(['/login']);
  }

  passwordsMatch(): boolean {
    return this.password === this.confirmPassword;
  }

  private getErrorMessage(error: any): string {
    if (error.code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Please sign in instead or use a different email.';
    } else if (error.code === 'auth/invalid-email') {
      return 'Invalid email address. Please enter a valid email format.';
    } else if (error.code === 'auth/weak-password') {
      return 'Password is too weak. Please choose a stronger password with at least 6 characters.';
    } else if (error.code === 'auth/operation-not-allowed') {
      return 'Email/password accounts are not enabled. Please contact support.';
    } else if (error.code === 'auth/network-request-failed') {
      return 'Network error. Please check your internet connection and try again.';
    } else {
      return 'An error occurred during registration. Please try again.';
    }
  }
} 