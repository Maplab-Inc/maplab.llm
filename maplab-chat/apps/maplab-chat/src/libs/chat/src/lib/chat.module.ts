import { NgModule } from '@angular/core';
import { ChatComponent } from './components/chat.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

const routes: Routes = [
  {
    path: '',
    component: ChatComponent,
  },
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
    FormsModule,
    CommonModule
  ],
  declarations: [ChatComponent],
  providers: []
})
export class ChatModule {}
