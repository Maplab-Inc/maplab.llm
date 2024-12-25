import { createReducer, on } from "@ngrx/store";
import { AssistantCompletion } from "../models/assistant-completion";
import { ChatActions } from "./chat.actions";

export interface State {
    completion: AssistantCompletion | null;
    loading: boolean;
    loaded: boolean;
}

export const initialState: State = {
    completion: null,
    loading: false,
    loaded: false,
};

export const reducer = createReducer(
    initialState,

    on(ChatActions.getCompletion, state => ({
        ...state,
        loading: true,
        loaded: false
    })),

    on(ChatActions.getCompletionSuccess, (state, action) => ({
        ...state,
        completion: action.completion,
        loading: false,
        loaded: true
    })),

    on(ChatActions.err, (state) => ({
        ...state,
        loading: false,
        loaded: false
    }))
);

export const getCompletion = (state: State): AssistantCompletion | null => state.completion;
export const getLoading = (state: State): boolean => state.loading;
export const getLoaded = (state: State): boolean => state.loaded;
