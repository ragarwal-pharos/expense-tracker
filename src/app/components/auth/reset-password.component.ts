import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { 
  confirmPasswordReset, 
  verifyPasswordResetCode 
} from '@angular/fire/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reset-password-container">
      <div class="reset-password-card">
        <div class="reset-password-header">
          <div class="brand">
            <span class="brand-icon">💰</span>
            <h1 class="brand-title">Expense Tracker</h1>
          </div>
          <p class="reset-password-subtitle">Set New Password</p>
        </div>

        <div *ngIf="!resetSuccess" class="reset-password-form">
          <p class="instruction-text">
            Enter your new password below. Make sure it's secure and easy to remember.
          </p>

          <form (ngSubmit)="resetPassword()" #resetForm="ngForm" class="reset-form">
            <div class="form-group">
              <label for="password" class="form-label">New Password</label>
              <input 
                type="password" 
                id="password"
                name="password"
                [(ngModel)]="password" 
                required
                minlength="6"
                class="form-control"
                placeholder="Enter your new password (min 6 characters)">
            </div>

            <div class="form-group">
              <label for="confirmPassword" class="form-label">Confirm New Password</label>
              <input 
                type="password" 
                id="confirmPassword"
                name="confirmPassword"
                [(ngModel)]="confirmPassword" 
                required
                class="form-control"
                placeholder="Confirm your new password">
            </div>

            <div class="form-actions">
              <button 
                type="submit" 
                class="btn-primary"
                [disabled]="!resetForm.form.valid || loading || !passwordsMatch()">
                <span *ngIf="loading" class="loading-spinner">⏳</span>
                <span *ngIf="!loading">Reset Password</span>
              </button>
            </div>
          </form>
        </div>

        <div *ngIf="resetSuccess" class="success-message">
          <div class="success-icon">✅</div>
          <h3 class="success-title">Password Reset Successful!</h3>
          <p class="success-text">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <div class="success-actions">
            <button class="btn-primary" (click)="goToLogin()">
              Sign In Now
            </button>
          </div>
        </div>

        <div *ngIf="invalidCode" class="error-message">
          <div class="error-icon">❌</div>
          <h3 class="error-title">Invalid Reset Link</h3>
          <p class="error-text">
            This password reset link is invalid or has expired. Please request a new reset link.
          </p>
          <div class="error-actions">
            <button class="btn-secondary" (click)="goToForgotPassword()">
              Request New Link
            </button>
          </div>
        </div>

        <div *ngIf="error" class="error-notification">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reset-password-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .reset-password-card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 450px;
    }

    .reset-password-header {
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

    .reset-password-subtitle {
      color: #666;
      margin: 0;
      font-size: 1rem;
    }

    .instruction-text {
      color: #666;
      text-align: center;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .reset-form {
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

    .btn-secondary {
      width: 100%;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      color: #495057;
      border: 2px solid #e9ecef;
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

    .btn-secondary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
      border-color: #667eea;
      color: #667eea;
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .success-message, .error-message {
      text-align: center;
      padding: 1rem 0;
    }

    .success-icon, .error-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      animation: bounce 0.6s ease-in-out;
    }

    .error-icon {
      color: #dc3545;
    }

    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-10px); }
      60% { transform: translateY(-5px); }
    }

    .success-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #28a745;
      margin: 0 0 1rem 0;
    }

    .error-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #dc3545;
      margin: 0 0 1rem 0;
    }

    .success-text, .error-text {
      color: #666;
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }

    .success-actions, .error-actions {
      margin-top: 1.5rem;
    }

    .error-notification {
      background: #fee;
      color: #c33;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      text-align: center;
      border: 1px solid #fcc;
    }

    @media (max-width: 480px) {
      .reset-password-card {
        padding: 2rem 1.5rem;
      }
      
      .brand-title {
        font-size: 1.5rem;
      }

      .success-icon, .error-icon {
        font-size: 2.5rem;
      }

      .success-title, .error-title {
        font-size: 1.25rem;
      }
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  password: string = '';
  confirmPassword: string = '';
  loading: boolean = false;
  resetSuccess: boolean = false;
  invalidCode: boolean = false;
  error: string = '';
  oobCode: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Get the oobCode from URL parameters
    this.route.queryParams.subscribe(params => {
      this.oobCode = params['oobCode'];
      if (!this.oobCode) {
        this.invalidCode = true;
        this.error = 'No reset code provided. Please use the link from your email.';
      } else {
        this.verifyResetCode();
      }
    });
  }

  async verifyResetCode() {
    try {
      await verifyPasswordResetCode(this.authService.getAuthInstance(), this.oobCode);
      // Code is valid, user can proceed
    } catch (error: any) {
      this.invalidCode = true;
      this.error = this.getErrorMessage(error);
    }
  }

  async resetPassword() {
    if (!this.passwordsMatch()) {
      this.error = 'Passwords do not match. Please try again.';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters long.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await confirmPasswordReset(this.authService.getAuthInstance(), this.oobCode, this.password);
      this.resetSuccess = true;
    } catch (error: any) {
      this.error = this.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  passwordsMatch(): boolean {
    return this.password === this.confirmPassword && this.password.length > 0;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  private getErrorMessage(error: any): string {
    if (error.code === 'auth/expired-action-code') {
      return 'The password reset link has expired. Please request a new one.';
    } else if (error.code === 'auth/invalid-action-code') {
      return 'The password reset link is invalid. Please request a new one.';
    } else if (error.code === 'auth/weak-password') {
      return 'Password is too weak. Please choose a stronger password.';
    } else if (error.code === 'auth/network-request-failed') {
      return 'Network error. Please check your internet connection and try again.';
    } else {
      return 'An error occurred while resetting your password. Please try again.';
    }
  }
}
