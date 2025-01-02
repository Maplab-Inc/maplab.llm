import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as reducer from './context.reducer';
import { Observable } from 'rxjs';
import { CompletionRequest } from '../../models/completion-request';
import { AssistantCompletion } from '../../models/assistant-completion';
import { ContextSelectors } from './context.selectors';
import { RouteOptimizationContext } from '../../models/route-optimization-context';
import { ContextActions } from './context.actions';

@Injectable()
export class ChatFacade {
  state$: Observable<reducer.State>;
  routeOptimizationContext$: Observable<RouteOptimizationContext | null>;

  constructor(private readonly store: Store<reducer.State>) {
    this.state$ = this.store.select(ContextSelectors.selectState);
    this.routeOptimizationContext$ = this.store.select(ContextSelectors.selectRouteOptimizationContext);
  }

  editRouteOptimizationContext(routeOptimizationContext: RouteOptimizationContext): void {
    this.store.dispatch(ContextActions.editContext({ routeOptimizationContext }));
  }
}
