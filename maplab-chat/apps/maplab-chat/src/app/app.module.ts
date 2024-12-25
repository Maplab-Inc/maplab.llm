import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';
import { ASSISTANT_API_URL } from '../libs/common/tokens/api-tokens';
import { getAssistantApiUrl } from '../configs/app-config';
import { AppConfigService } from '../configs/app-config.service';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment.prod';
import { MessageService } from 'primeng/api';
import { ChatModule } from '@maplab-chat/chat';

@NgModule({
  declarations: [AppComponent],
  imports: [
    CommonModule,
    ChatModule,
    BrowserModule,
    AppRoutingModule,
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
    {
      provide: ASSISTANT_API_URL,
      useFactory: getAssistantApiUrl,
      multi: false,
      deps: [AppConfigService],
    },
    MessageService
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
