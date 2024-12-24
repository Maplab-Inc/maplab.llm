import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';

export const ROUTES: Route[] = [
    {
        path: '',
        loadChildren: () =>
          import('@maplab-chat/chat').then(
            (m) => m.ChatModule,
          ),
      },
];

@NgModule({
  imports: [
    RouterModule.forRoot(ROUTES, {
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule { }