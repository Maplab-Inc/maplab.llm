import * as reducer from './context.reducer';
import { createFeatureSelector, createSelector } from '@ngrx/store';

export const selectState = createFeatureSelector<reducer.State>('context');

const selectRouteOptimizationContext = createSelector(selectState, reducer.getRouteOptimizationContext);

export const ContextSelectors = {
  selectState,
  selectRouteOptimizationContext,
};
