import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';
import { provideHotToastConfig } from '@ngxpert/hot-toast';
import { definePreset } from '@primeng/themes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { interceptorsProviders } from '@core/interceptor/interceptors-provider';


const MyPreset = definePreset(Aura, {
  components: {
    button: {
      ColorScheme: {
        light: {
          root: {
            primary: {
              background: '{surface.100}',
            }
          }
        }
      }
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: '.dark',
        },
      }
    }), 
    provideHotToastConfig(),
    provideHttpClient(withInterceptors(interceptorsProviders)),
  ]
};
