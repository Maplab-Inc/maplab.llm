import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as reducer from './chat.reducer';
import { Observable } from 'rxjs';
import { CompletionRequest } from '../models/completion-request';
import { ChatActions } from './chat.actions';
import { AssistantCompletion } from '../models/assistant-completion';
import { ChatSelectors } from './chat.selectors';

@Injectable()
export class ApiKeyFacade {
  state$: Observable<reducer.State>;
  chat$: Observable<AssistantCompletion | null>;
  chatLoading$: Observable<boolean>;
  chatLoaded$: Observable<boolean>;

  constructor(private readonly store: Store<reducer.State>) {
    this.state$ = this.store.select(ChatSelectors.selectState);
    this.chat$ = this.store.select(ChatSelectors.selectTenant);
    this.chatLoading$ = this.store.select(ChatSelectors.selectLoading);
    this.chatLoaded$ = this.store.select(ChatSelectors.selectLoaded);
  }

  getCompletion(request: CompletionRequest): void {
    this.store.dispatch(ChatActions.getCompletion({ request }));
  }
}
