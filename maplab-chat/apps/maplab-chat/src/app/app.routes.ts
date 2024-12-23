import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: 'auth',
        loadChildren: () =>
          import('@maplab-chat/chat').then(
            (m) => m.CommonAngularFeatureAuthRoutingModule,
          ),
      },
];
