import * as reducer from './chat.reducer';
import { createFeatureSelector, createSelector } from '@ngrx/store';

export const selectState = createFeatureSelector<reducer.State>('chat');

const selectTenant = createSelector(selectState, reducer.getCompletion);

const selectLoading = createSelector(selectState, reducer.getLoading);

const selectLoaded = createSelector(selectState, reducer.getLoaded);

export const ChatSelectors = {
  selectState,
  selectTenant,
  selectLoading,
  selectLoaded,
};
