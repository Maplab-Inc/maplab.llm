import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';

export const ROUTES: Route[] = [
  {
    path: '',
    redirectTo: 'app',
    loadChildren: () =>
        import('@maplab.llm.ui/chat').then(
          (module) => module.ChatModule,
        ),
  },
];
@NgModule({
    imports: [RouterModule.forRoot(ROUTES, {})],
    exports: [RouterModule],
  })
  export class AppRoutingModule {}
