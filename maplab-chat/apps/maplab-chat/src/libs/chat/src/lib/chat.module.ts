import { NgModule } from '@angular/core';
import { ChatComponent } from './components/chat.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { ChatEffects } from './+state/chat.effects';
import { reducer } from './+state/chat.reducer';
import { ChatService } from './services/chat.service';
import { HttpClientModule } from '@angular/common/http';
import { ChatFacade } from './+state/chat.facade';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';

const routes: Routes = [
  {
    path: '',
    component: ChatComponent,
  },
];

@NgModule({
  imports: [
    FormsModule,
    CommonModule,
    ProgressSpinnerModule,
    ButtonModule,
    HttpClientModule,
    RouterModule.forChild(routes),
    StoreModule.forFeature('chat', reducer),
    EffectsModule.forFeature([ChatEffects]),
  ],
  declarations: [ChatComponent],
  providers: [
    ChatService,
    ChatFacade
  ]
})
export class ChatModule {}
