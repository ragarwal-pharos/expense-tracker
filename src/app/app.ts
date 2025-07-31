import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/layout/navbar/navbar.component';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { NotificationsComponent } from './components/shared/notifications/notifications.component';
import { LoadingComponent } from './components/shared/loading/loading.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, SidebarComponent, NotificationsComponent, LoadingComponent],
  templateUrl: './app.html',
  styles: [`
    /* Mobile Navbar */
    .mobile-navbar {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      box-shadow: 0 4px 20px rgba(255, 107, 53, 0.3);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1030;
      padding: 1rem 0;
      width: 100%;
      margin: 0;
    }

    .mobile-navbar::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
      animation: shimmer 3s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .mobile-navbar-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      position: relative;
      z-index: 1;
      width: 100%;
    }

    .sidebar-toggle-btn {
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      width: 45px;
      height: 45px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .sidebar-toggle-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.6);
      transform: scale(1.1);
    }

    .toggle-icon {
      font-size: 1.3rem;
      font-weight: 600;
    }

    .mobile-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: white;
      flex: 1;
      justify-content: center;
    }

    .brand-icon {
      font-size: 1.8rem;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      width: 45px;
      height: 45px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .mobile-brand:hover .brand-icon {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .brand-text {
      font-size: 1.2rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .mobile-theme-toggle {
      background: linear-gradient(135deg, #ffd23f 0%, #3ec300 100%);
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      width: 45px;
      height: 45px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: all 0.3s ease;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(255, 210, 63, 0.3);
    }

    .mobile-theme-toggle:hover {
      background: linear-gradient(135deg, #3ec300 0%, #ffd23f 100%);
      border-color: rgba(255, 255, 255, 0.6);
      transform: scale(1.15);
      box-shadow: 0 8px 25px rgba(255, 210, 63, 0.4);
    }

    .theme-icon {
      font-size: 1.3rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .mobile-theme-toggle:hover .theme-icon {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.4);
    }

    /* Main Content Blur Effect */
    .main-content {
      transition: filter 0.3s ease;
      padding-top: 80px; /* Account for fixed navbar height */
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }

    .main-content.blurred {
      filter: blur(5px);
      pointer-events: none;
      user-select: none;
      overflow: hidden;
      position: relative;
      z-index: 1;
    }

    /* Mobile responsive adjustments */
    @media (max-width: 768px) {
      html, body {
        height: 100dvh;
        min-height: 100dvh;
        max-height: 100dvh;
        overflow-x: hidden;
      }
      
      .app-container {
        height: 100dvh;
        min-height: 100dvh;
        max-height: 100dvh;
        overflow-x: hidden;
      }
      
      .main-content {
        height: calc(100dvh - 60px);
        min-height: calc(100dvh - 60px);
        max-height: calc(100dvh - 60px);
        overflow-y: auto;
        overflow-x: hidden;
        padding-top: 60px;
      }
      
      .mobile-navbar {
        height: 50px;
        min-height: 50px;
        max-height: 50px;
        padding: 0.5rem 0;
      }
      
      .mobile-navbar-content {
        padding: 0 1rem;
      }
      
      .sidebar-toggle-btn,
      .mobile-theme-toggle {
        width: 40px;
        height: 40px;
      }
      
      .brand-icon {
        width: 35px;
        height: 35px;
        font-size: 1.5rem;
      }
      
      .brand-text {
        font-size: 1rem;
      }
      
      /* Prevent body scroll when sidebar is open */
      body.sidebar-open {
        height: 100dvh;
        overflow: hidden;
        position: fixed;
        width: 100%;
      }
    }
    
    /* Extra small devices */
    @media (max-width: 480px) {
      .main-content {
        height: calc(100dvh - 50px);
        min-height: calc(100dvh - 50px);
        max-height: calc(100dvh - 50px);
        padding-top: 50px;
      }
      
      .mobile-navbar {
        height: 45px;
        min-height: 45px;
        max-height: 45px;
        padding: 0.4rem 0;
      }
      
      .sidebar-toggle-btn,
      .mobile-theme-toggle {
        width: 35px;
        height: 35px;
      }
      
      .brand-icon {
        width: 30px;
        height: 30px;
        font-size: 1.3rem;
      }
      
      .brand-text {
        font-size: 0.9rem;
      }
    }
    
    /* Landscape orientation */
    @media (max-width: 768px) and (orientation: landscape) {
      .main-content {
        height: calc(100dvh - 45px);
        min-height: calc(100dvh - 45px);
        max-height: calc(100dvh - 45px);
        padding-top: 45px;
      }
      
      .mobile-navbar {
        height: 40px;
        min-height: 40px;
        max-height: 40px;
        padding: 0.3rem 0;
      }
      
      .sidebar-toggle-btn,
      .mobile-theme-toggle {
        width: 32px;
        height: 32px;
      }
      
      .brand-icon {
        width: 28px;
        height: 28px;
        font-size: 1.2rem;
      }
      
      .brand-text {
        font-size: 0.85rem;
      }
    }
    
    /* Desktop navbar - ensure it's fixed */
    @media (min-width: 769px) {
      .navbar-modern {
        position: fixed !important;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1030;
      }
      
      .main-content {
        padding-top: 80px;
      }
    }
  `]
})
export class App {
  sidebarOpen = false;
  isMobile = false;

  constructor(private themeService: ThemeService) {
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
      this.removeBlurEffect();
    });
    
    // Prevent scrolling when sidebar is open
    window.addEventListener('scroll', (e) => {
      if (this.sidebarOpen) {
        e.preventDefault();
        window.scrollTo(0, 0);
      }
    }, { passive: false });
    
    // Prevent touch scrolling when sidebar is open
    window.addEventListener('touchmove', (e) => {
      if (this.sidebarOpen) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Force navbar to stay fixed on desktop
    this.forceNavbarFixed();
    
    // Re-apply navbar fix on scroll to ensure it stays fixed
    window.addEventListener('scroll', () => {
      this.forceNavbarFixed();
    });
  }

  forceNavbarFixed() {
    if (window.innerWidth >= 769) {
      const navbar = document.querySelector('.navbar-modern') as HTMLElement;
      if (navbar) {
        navbar.style.position = 'fixed';
        navbar.style.top = '0';
        navbar.style.left = '0';
        navbar.style.right = '0';
        navbar.style.zIndex = '1030';
        navbar.style.width = '100%';
        navbar.style.height = '80px';
        navbar.style.minHeight = '80px';
        navbar.style.maxHeight = '80px';
        navbar.style.background = 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)';
        navbar.style.boxShadow = '0 4px 20px rgba(255, 107, 53, 0.3)';
      }
      
      // Also ensure main content has proper padding
      const mainContent = document.querySelector('.main-content') as HTMLElement;
      if (mainContent) {
        mainContent.style.paddingTop = '80px';
        mainContent.style.minHeight = 'calc(100vh - 80px)';
      }
    }
  }

  checkScreenSize() {
    this.isMobile = window.innerWidth < 992; // Use lg breakpoint (992px) to match navbar-expand-lg
    
    // Remove blur effect when switching views
    this.removeBlurEffect();
  }

  removeBlurEffect() {
    if (!this.sidebarOpen) {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.remove('blurred');
      }
    }
  }

  openSidebar() {
    this.sidebarOpen = true;
    // Prevent body scrolling when sidebar is open
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;
  }

  closeSidebar() {
    this.sidebarOpen = false;
    // Restore body scrolling when sidebar is closed
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  getThemeIcon(): string {
    return this.themeService.getTheme() === 'light' ? '🌙' : '☀️';
  }
}
