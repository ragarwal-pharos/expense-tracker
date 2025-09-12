import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="brand">
            <span class="brand-icon">💰</span>
            <h1 class="brand-title">Expense Tracker</h1>
          </div>
          <p class="login-subtitle">Sign in to manage your expenses</p>
        </div>

        <form (ngSubmit)="signIn()" #loginForm="ngForm" class="login-form">
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
            <div class="password-input-container">
              <input 
                [type]="showPassword ? 'text' : 'password'" 
                id="password"
                name="password"
                [(ngModel)]="password" 
                required
                class="form-control password-input"
                placeholder="Enter your password">
              <button 
                type="button" 
                class="password-toggle-btn"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
                <span class="eye-icon">{{ showPassword ? '🙈' : '👁️' }}</span>
              </button>
            </div>
            <div class="forgot-password-link">
              <a (click)="goToForgotPassword()" class="link">Forgot Password?</a>
            </div>
          </div>

          <div class="form-actions">
            <button 
              type="submit" 
              class="btn-primary"
              [disabled]="!loginForm.form.valid || loading">
              <span *ngIf="loading" class="loading-spinner">⏳</span>
              <span *ngIf="!loading">Sign In</span>
            </button>
          </div>
        </form>

        <div class="register-link">
          <p>Don't have an account? <a (click)="goToRegister()" class="link">Sign up</a></p>
        </div>

        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .login-card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }

    .login-header {
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

    .login-subtitle {
      color: #666;
      margin: 0;
      font-size: 1rem;
    }

    .login-form {
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

    .password-input-container {
      position: relative;
    }

    .password-input {
      padding-right: 3rem;
    }

    .password-toggle-btn {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }

    .password-toggle-btn:hover {
      background-color: rgba(102, 126, 234, 0.1);
    }

    .password-toggle-btn:focus {
      outline: none;
      background-color: rgba(102, 126, 234, 0.1);
    }

    .eye-icon {
      font-size: 1.2rem;
      user-select: none;
    }

    .forgot-password-link {
      text-align: right;
      margin-top: 0.5rem;
    }

    .forgot-password-link .link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition: color 0.3s ease;
    }

    .forgot-password-link .link:hover {
      color: #5a6fd8;
      text-decoration: underline;
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



    .register-link {
      text-align: center;
      margin-top: 1rem;
    }

    .register-link p {
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
      .login-card {
        padding: 2rem 1.5rem;
      }
      
      .brand-title {
        font-size: 1.5rem;
      }
    }
  `]
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  loading: boolean = false;
  error: string = '';
  showPassword: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async signIn() {
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.authService.signIn(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.error = this.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }



  goToRegister() {
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private getErrorMessage(error: any): string {
    if (error.code === 'auth/user-not-found') {
      return 'No account found with this email address. Please check your email or create a new account.';
    } else if (error.code === 'auth/wrong-password') {
      return 'Incorrect password. Please check your password and try again.';
    } else if (error.code === 'auth/invalid-email') {
      return 'Invalid email address. Please enter a valid email format.';
    } else if (error.code === 'auth/too-many-requests') {
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    } else if (error.code === 'auth/network-request-failed') {
      return 'Network error. Please check your internet connection and try again.';
    } else {
      return 'An error occurred during sign-in. Please try again.';
    }
  }
} 