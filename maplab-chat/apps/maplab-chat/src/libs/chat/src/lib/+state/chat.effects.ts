import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { ChatActions } from './chat.actions';
import { exhaustMap, map, tap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AssistantCompletion } from '../models/assistant-completion';
import { ChatService } from '../services/chat.service';

@Injectable()
export class ChatEffects {
  get$ = createEffect(() =>
    this.actions$.pipe(
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
    private readonly actions$: Actions,
    private chatService: ChatService,
    private messageService: MessageService
  ) {}
}
