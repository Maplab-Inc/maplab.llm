import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';
import {
  ASSISTANT_API_URL,
  DIRECTIONS_API_URL,
} from '../libs/common/tokens/api-tokens';
import { getAssistantApiUrl, getDirectionsApiUrl } from '../configs/app-config';
import { AppConfigService } from '../configs/app-config.service';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment.prod';
import { MessageService } from 'primeng/api';
import { ChatModule } from '@maplab-chat/chat';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppPreset } from './app.preset';

@NgModule({
  declarations: [AppComponent],
  imports: [
    CommonModule,
    BrowserModule,
    AppRoutingModule,
    ProgressSpinnerModule,
    ChatModule,

    StoreModule.forRoot({}),
    EffectsModule.forRoot({}),
    StoreDevtoolsModule.instrument({
      maxAge: 25, // Retains last 25 states
      logOnly: environment.production, // Restrict extension to log-only mode
      autoPause: true, // Pauses recording actions and state changes when the extension window is not open
    }),
  ],
  providers: [
    AppConfigService,
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: AppPreset,
        
      },
    }),
    {
      provide: ASSISTANT_API_URL,
      useFactory: getAssistantApiUrl,
      multi: false,
      deps: [AppConfigService],
    },
    {
      provide: DIRECTIONS_API_URL,
      useFactory: getDirectionsApiUrl,
      multi: false,
      deps: [AppConfigService],
    },
    MessageService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
