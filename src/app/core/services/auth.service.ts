import { Injectable } from '@angular/core';
import { 
  Auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  updateProfile,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null | undefined>(undefined);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private auth: Auth) {
    // Listen to authentication state changes
    onAuthStateChanged(this.auth, (user) => {
      console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
      this.currentUserSubject.next(user);
    });
  }

  // Get auth instance for password reset
  getAuthInstance() {
    return this.auth;
  }

  // Get current user
  getCurrentUser(): User | null {
    const value = this.currentUserSubject.value;
    return value === undefined ? null : value;
  }

  // Get current user ID
  getCurrentUserId(): string | null {
    const user = this.getCurrentUser();
    return user ? user.uid : null;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  // Register with email and password
  async register(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Update display name if provided
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }
      
      console.log('User registered successfully:', userCredential.user.email);
      return userCredential.user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('User signed in successfully:', userCredential.user.email);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      console.log('Attempting to send password reset email to:', email);
      console.log('Auth instance:', this.auth);
      
      // Validate email format
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email address');
      }
      
      await sendPasswordResetEmail(this.auth, email);
      console.log('Password reset email sent successfully to:', email);
      
      // Additional logging for debugging
      console.log('Firebase Auth state:', this.auth.currentUser);
      console.log('Firebase config:', this.auth.app.options);
      
    } catch (error: any) {
      console.error('Password reset error details:', {
        code: error.code,
        message: error.message,
        email: email,
        authState: this.auth.currentUser ? 'User logged in' : 'No user logged in'
      });
      
      // Enhanced error messages
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address. Please check your email or create a new account.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address format. Please enter a valid email.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many password reset requests. Please wait a few minutes and try again.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Password reset is not enabled for this Firebase project. Please contact support.');
      } else {
        throw new Error(`Password reset failed: ${error.message || 'Unknown error occurred'}`);
      }
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Get user profile
  getUserProfile(): UserProfile | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || undefined,
      photoURL: user.photoURL || undefined,
      createdAt: new Date(user.metadata.creationTime || Date.now())
    };
  }


} 