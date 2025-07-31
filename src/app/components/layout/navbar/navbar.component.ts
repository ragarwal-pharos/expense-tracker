import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { ScrollService } from '../../../core/services/scroll.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  constructor(
    public themeService: ThemeService,
    private scrollService: ScrollService
  ) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  onNavClick() {
    // Scroll to top of the page when navbar link is clicked
    this.scrollService.scrollToTop();
  }
} 