import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingHeaderComponent } from "./pages/landing-header/landing-header.component";
import { LandingHeroComponent } from "./pages/landing-hero/landing-hero.component";
import { LandingHowSectionComponent } from "./pages/landing-how-section/landing-how-section.component";
import { LandingDownloadComponent } from "./pages/landing-download/landing-download.component";
import { LandingContactComponent } from "./pages/landing-contact/landing-contact.component";
import { LandingFooterComponent } from "./pages/landing-footer/landing-footer.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LandingHeaderComponent, LandingHeroComponent, LandingHowSectionComponent, LandingDownloadComponent, LandingContactComponent, LandingFooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'landing-project';
}
