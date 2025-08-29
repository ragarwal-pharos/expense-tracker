import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ScrollService } from './core/services/scroll.service';
import { AuthService } from './core/services/auth.service';
import { take, filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styles: [`
    /* App Container */
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }

    /* Ensure html and body don't interfere */
    html, body {
      overflow-x: hidden;
      position: relative;
      height: 100%;
      margin: 0;
      padding: 0;
    }

    /* Use dynamic viewport height for mobile */
    @supports (height: 100dvh) {
      .sidebar,
      .sidebar-overlay {
        height: 100dvh;
        min-height: 100dvh;
        max-height: 100dvh;
      }
    }

    /* Force full height on mobile browsers */
    @media (max-width: 768px) {
      .sidebar,
      .sidebar-overlay {
        height: 100vh !important;
        min-height: 100vh !important;
        max-height: 100vh !important;
        top: 0 !important;
      }
    }

    /* Header */
    .app-header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      padding: 0;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      // max-width: 1200px;
      margin: 0 auto;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .sidebar-toggle {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 8px;
      padding: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      min-width: 44px;
      min-height: 44px;
    }

    .sidebar-toggle:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    /* Hide sidebar toggle on desktop when nav is visible */
    @media (min-width: 769px) {
      .sidebar-toggle {
        display: none;
      }
    }

    .hamburger-icon {
      font-size: 1.2rem;
      color: white;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .brand-icon {
      font-size: 1.5rem;
    }

    .brand-text {
      font-size: 1.2rem;
      font-weight: 600;
      color: white;
    }

    .header-nav {
      display: flex;
      gap: 1rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.3s ease;
      font-weight: 500;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    .nav-link.active {
      background: rgba(255, 255, 255, 0.3);
    }

    .nav-icon {
      font-size: 1rem;
    }

                .nav-text {
              font-size: 0.9rem;
            }

            /* User Section */
            .user-section {
              display: flex;
              align-items: center;
              margin-left: 1rem;
            }

            .user-info {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              background: rgba(255, 255, 255, 0.2);
              padding: 0.5rem 1rem;
              border-radius: 8px;
              backdrop-filter: blur(10px);
            }

            .user-name {
              color: white;
              font-weight: 500;
              font-size: 0.9rem;
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .sign-out-btn {
              background: rgba(255, 255, 255, 0.2);
              border: none;
              border-radius: 6px;
              padding: 0.25rem 0.5rem;
              cursor: pointer;
              transition: all 0.3s ease;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .sign-out-btn:hover {
              background: rgba(255, 255, 255, 0.3);
              transform: scale(1.05);
            }

            .sign-out-icon {
              font-size: 0.9rem;
              color: white;
            }

            /* Auth Container */
            .auth-container {
              min-height: 100vh;
              width: 100%;
            }



    /* Sidebar */
    .sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      max-height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 200;
      backdrop-filter: blur(4px);
      padding-top: env(safe-area-inset-top);
      box-sizing: border-box;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: -300px;
      width: 300px;
      height: 100vh;
      min-height: 100vh;
      max-height: 100vh;
      background: linear-gradient(135deg, #ff8c42 0%, #ffa726 50%, #ffcc02 100%);
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
      z-index: 300;
      transition: left 0.3s ease;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding-top: env(safe-area-inset-top);
      box-sizing: border-box;
    }

    .sidebar.sidebar-open {
      left: 0;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      flex-shrink: 0;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .sidebar-nav {
      padding: 1rem 0;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      color: white;
      text-decoration: none;
      transition: all 0.3s ease;
      border-left: 3px solid transparent;
    }

    .sidebar-link:hover {
      background: rgba(255, 255, 255, 0.1);
      border-left-color: rgba(255, 255, 255, 0.5);
    }

    .sidebar-link.active {
      background: rgba(255, 255, 255, 0.2);
      border-left-color: white;
    }

    .link-icon {
      font-size: 1.2rem;
      width: 24px;
      text-align: center;
    }

    .link-text {
      font-size: 1rem;
      font-weight: 500;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      background: #f8f9fa;
      transition: filter 0.3s ease;
      margin-top: 70px; /* Account for fixed header height */
    }

    .main-content.content-blurred {
      filter: blur(4px);
      pointer-events: none;
    }

    .content-container {
      // max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .header-content {
        padding: 1rem;
      }

      .header-nav {
        display: none;
      }

      .sidebar-toggle {
        display: flex;
      }

      .sidebar {
        width: 280px;
        left: -280px;
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .sidebar-overlay {
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .main-content {
        margin-top: 65px; /* Slightly smaller margin for mobile */
      }

      .content-container {
        padding: 1rem;
      }

      .brand-text {
        font-size: 1.1rem;
      }

      .user-section {
        margin-left: 0.5rem;
      }

      .user-info {
        padding: 0.25rem 0.5rem;
      }

      .user-name {
        max-width: 100px;
        font-size: 0.8rem;
      }
    }

    @media (max-width: 480px) {
      .header-content {
        padding: 0.75rem;
      }

      .sidebar {
        width: 260px;
        left: -260px;
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .sidebar-overlay {
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .main-content {
        margin-top: 60px; /* Even smaller margin for very small screens */
      }

      .content-container {
        padding: 0.75rem;
      }
    }

    /* Loading Container */
    .loading-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 1.2rem;
    }

    .loading-spinner {
      font-size: 3rem;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class App {
  sidebarOpen = false;

  constructor(
    private scrollService: ScrollService,
    private authService: AuthService,
    private router: Router
  ) {
    // Restore the last visited route on app initialization
    this.restoreLastRoute();
    
    // Save route on every navigation
    this.router.events.subscribe(() => {
      this.saveCurrentRoute();
    });
  }

  get currentUser$() {
    return this.authService.currentUser$;
  }

  toggleSidebar() {
    console.log('Toggle sidebar called');
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeSidebar() {
    console.log('Close sidebar called');
    this.sidebarOpen = false;
    document.body.style.overflow = '';
  }

  async signOut() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Route persistence methods
  private saveCurrentRoute() {
    const currentRoute = this.router.url;
    if (currentRoute && currentRoute !== '/login' && currentRoute !== '/register') {
      localStorage.setItem('lastRoute', currentRoute);
    }
  }

  private restoreLastRoute() {
    const lastRoute = localStorage.getItem('lastRoute');
    if (lastRoute && lastRoute !== '/login' && lastRoute !== '/register') {
      // Check if user is authenticated before restoring route
      this.authService.currentUser$.pipe(
        filter(user => user !== undefined),
        take(1)
      ).subscribe(user => {
        if (user && this.router.url === '/dashboard') {
          // Only restore route if we're currently on dashboard (initial load)
          // Use setTimeout to ensure navigation happens after route initialization
          setTimeout(() => {
            this.router.navigate([lastRoute]);
          }, 100);
        }
      });
    }
  }

  onNavClick() {
    this.closeSidebar();
    this.scrollService.scrollToTop();
    this.saveCurrentRoute();
  }
}
