import { createAction, props } from '@ngrx/store';
import { RouteOptimizationContext } from '../../models/route-optimization-context';

const NAMESPACE = '[CONTEXT]';

const editContext = createAction(
  `${NAMESPACE} Edit`,
  props<{ routeOptimizationContext: RouteOptimizationContext }>()
);

const err = createAction(`${NAMESPACE} Error`, props<{ errMsg: string }>());

export const ContextActions = {
  editContext,
  err
};
