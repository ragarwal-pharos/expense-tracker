import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="forgot-password-container">
      <div class="forgot-password-card">
        <div class="forgot-password-header">
          <div class="brand">
            <span class="brand-icon">💰</span>
            <h1 class="brand-title">Expense Tracker</h1>
          </div>
          <p class="forgot-password-subtitle">Reset your password</p>
        </div>

        <div *ngIf="!emailSent" class="forgot-password-form">
          <p class="instruction-text">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form (ngSubmit)="sendResetEmail()" #resetForm="ngForm" class="reset-form">
            <div class="form-group">
              <label for="email" class="form-label">Email Address</label>
              <input 
                type="email" 
                id="email"
                name="email"
                [(ngModel)]="email" 
                required
                class="form-control"
                placeholder="Enter your email address">
            </div>

            <div class="form-actions">
              <button 
                type="submit" 
                class="btn-primary"
                [disabled]="!resetForm.form.valid || loading">
                <span *ngIf="loading" class="loading-spinner">⏳</span>
                <span *ngIf="!loading">Send Reset Link</span>
              </button>
            </div>
          </form>
        </div>

        <div *ngIf="emailSent" class="success-message">
          <div class="success-icon">✅</div>
          <h3 class="success-title">Check Your Email</h3>
          <p class="success-text">
            We've sent a password reset link to <strong>{{ email }}</strong>
          </p>
          <p class="success-instruction">
            Click the link in the email to reset your password. The link will expire in 1 hour.
          </p>
          
          <!-- Additional troubleshooting tips -->
          <div class="troubleshooting-tips">
            <h4>Not receiving the email?</h4>
            <ul>
              <li>Check your spam/junk folder</li>
              <li>Verify the email address is correct</li>
              <li>Wait a few minutes for delivery</li>
              <li>Add noreply@expense-tracker-4d264.firebaseapp.com to your contacts</li>
            </ul>
          </div>
          
          <div class="success-actions">
            <button class="btn-secondary" (click)="resendEmail()" [disabled]="resendLoading">
              <span *ngIf="resendLoading" class="loading-spinner">⏳</span>
              <span *ngIf="!resendLoading">Resend Email</span>
            </button>
          </div>
        </div>

        <div class="navigation-links">
          <a (click)="goToLogin()" class="link">← Back to Sign In</a>
        </div>

        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>

        <div *ngIf="success" class="success-notification">
          {{ success }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .forgot-password-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .forgot-password-card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 450px;
    }

    .forgot-password-header {
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

    .forgot-password-subtitle {
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

    .btn-secondary:disabled {
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

    .success-message {
      text-align: center;
      padding: 1rem 0;
    }

    .success-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      animation: bounce 0.6s ease-in-out;
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

    .success-text {
      color: #666;
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .success-instruction {
      color: #888;
      font-size: 0.9rem;
      margin: 0 0 1.5rem 0;
      line-height: 1.4;
    }

    .success-actions {
      margin-top: 1.5rem;
    }

    .navigation-links {
      text-align: center;
      margin-top: 1.5rem;
    }

    .link {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      cursor: pointer;
      transition: color 0.3s ease;
    }

    .link:hover {
      color: #5a6fd8;
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

    .success-notification {
      background: #d4edda;
      color: #155724;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      text-align: center;
      border: 1px solid #c3e6cb;
    }

    .troubleshooting-tips {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }

    .troubleshooting-tips h4 {
      font-size: 1rem;
      color: #555;
      margin-bottom: 0.5rem;
    }

    .troubleshooting-tips ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .troubleshooting-tips li {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 0.3rem;
      line-height: 1.4;
    }

    @media (max-width: 480px) {
      .forgot-password-card {
        padding: 2rem 1.5rem;
      }
      
      .brand-title {
        font-size: 1.5rem;
      }

      .success-icon {
        font-size: 2.5rem;
      }

      .success-title {
        font-size: 1.25rem;
      }
    }
  `]
})
export class ForgotPasswordComponent {
  email: string = '';
  loading: boolean = false;
  resendLoading: boolean = false;
  emailSent: boolean = false;
  error: string = '';
  success: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async sendResetEmail() {
    if (!this.email) {
      this.error = 'Please enter your email address';
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.error = 'Please enter a valid email address';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      await this.authService.sendPasswordResetEmail(this.email);
      this.emailSent = true;
      
      // Show additional helpful information
      this.success = `Reset link sent to ${this.email}. Please check your email (including spam folder).`;
      
    } catch (error: any) {
      console.error('Error in sendResetEmail:', error);
      
      // Provide specific guidance based on error
      if (error.message.includes('No account found')) {
        this.error = `${error.message} If you're sure this is the correct email, try creating a new account.`;
      } else if (error.message.includes('network')) {
        this.error = `${error.message} Please check your internet connection.`;
      } else if (error.message.includes('too many requests')) {
        this.error = `${error.message} Please wait 5-10 minutes before trying again.`;
      } else {
        this.error = error.message || 'An error occurred while sending the reset email. Please try again.';
      }
    } finally {
      this.loading = false;
    }
  }

  async resendEmail() {
    this.resendLoading = true;
    this.error = '';
    this.success = '';

    try {
      await this.authService.sendPasswordResetEmail(this.email);
      this.success = 'Reset link sent again successfully!';
    } catch (error: any) {
      this.error = this.getErrorMessage(error);
    } finally {
      this.resendLoading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  private getErrorMessage(error: any): string {
    if (error.code === 'auth/user-not-found') {
      return 'No account found with this email address. Please check your email or create a new account.';
    } else if (error.code === 'auth/invalid-email') {
      return 'Invalid email address. Please enter a valid email format.';
    } else if (error.code === 'auth/too-many-requests') {
      return 'Too many requests. Please wait a few minutes and try again.';
    } else if (error.code === 'auth/network-request-failed') {
      return 'Network error. Please check your internet connection and try again.';
    } else {
      return 'An error occurred while sending the reset email. Please try again.';
    }
  }
}
