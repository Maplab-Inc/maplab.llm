import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'app',
    loadChildren: () =>
        import('@maplab.llm.ui/chat').then(
          (module) => module.ChatModule,
        ),
  },
];
