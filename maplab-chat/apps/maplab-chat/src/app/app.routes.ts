import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',
        loadChildren: () =>
          import('@maplab-chat/chat').then(
            (m) => m.ChatModule,
          ),
      },
];
