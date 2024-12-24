import { createAction, props } from '@ngrx/store';
import { CompletionRequest } from '../models/completion-request';
import { AssistantCompletion } from '../models/assistant-completion';

const NAMESPACE = '[CHAT]';

const getCompletion = createAction(
  `${NAMESPACE} Get`,
  props<{ request: CompletionRequest }>()
);

const getCompletionSuccess = createAction(
  `${NAMESPACE} Get Success`,
  props<{ completion: AssistantCompletion }>()
);

const err = createAction(`${NAMESPACE} Error`, props<{ errMsg: string }>());

export const ChatActions = {
  getCompletion,
  getCompletionSuccess,
  err,
};
