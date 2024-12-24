import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';
import { ASSISTANT_API_URL } from '../libs/common/tokens/api-tokens';
import { getAssistantApiUrl } from '../configs/app-config';
import { AppConfigService } from '../configs/app-config.service';

@NgModule({
  declarations: [AppComponent],
  imports: [
    CommonModule,
    BrowserModule,
    AppRoutingModule
  ],
  providers: [
    {
      provide: ASSISTANT_API_URL,
      useFactory: getAssistantApiUrl,
      multi: false,
      deps: [AppConfigService],
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
