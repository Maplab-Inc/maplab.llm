import { createAction, props } from '@ngrx/store';
import { IJob } from '../../models/job';
import { IVehicle } from '../../models/vehicle';

const NAMESPACE = '[CONTEXT]';

const updateRouteOptimizationJobs = createAction(
  `${NAMESPACE} Update Route Optimization Jobs`,
  props<{ jobs: IJob[] }>()
);

const updateRouteOptimizationVehicles = createAction(
  `${NAMESPACE} Update Route Optimization Vehicles`,
  props<{ vehicles: IVehicle[] }>()
);

const err = createAction(`${NAMESPACE} Error`, props<{ errMsg: string }>());

export const ContextActions = {
  updateRouteOptimizationJobs,
  updateRouteOptimizationVehicles,
  err
};
