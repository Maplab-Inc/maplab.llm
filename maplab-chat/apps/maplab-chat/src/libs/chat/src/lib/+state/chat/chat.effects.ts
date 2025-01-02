import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { ChatActions } from './chat.actions';
import { exhaustMap, map, tap } from 'rxjs';
import { AssistantCompletion } from '../../models/assistant-completion';
import { ChatService } from '../../services/chat.service';

@Injectable()
export class ChatEffects {
  get$ = createEffect(() =>
    inject(Actions).pipe(
      ofType(ChatActions.getCompletion),
      exhaustMap((action) =>
        this.chatService
          .getCompletion(action.request)
          .pipe(
            map((completion: AssistantCompletion) =>
              ChatActions.getCompletionSuccess({ completion })
            )
          )
      )
    )
  );

  constructor(
    private chatService: ChatService
  ) {}
}
