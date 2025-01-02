import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as reducer from './context.reducer';
import { Observable } from 'rxjs';
import { ContextSelectors } from './context.selectors';
import { RouteOptimizationContext } from '../../models/route-optimization-context';
import { ContextActions } from './context.actions';
import { IJob } from '../../models/job';
import { IVehicle } from '../../models/vehicle';

@Injectable()
export class ContextFacade {
  state$: Observable<reducer.State>;
  routeOptimizationContext$: Observable<RouteOptimizationContext | null>;

  constructor(private readonly store: Store<reducer.State>) {
    this.state$ = this.store.select(ContextSelectors.selectState);
    this.routeOptimizationContext$ = this.store.select(ContextSelectors.selectRouteOptimizationContext);
  }

  updateRouteOptimizationJobs(jobs: IJob[]): void {
    this.store.dispatch(ContextActions.updateRouteOptimizationJobs({ jobs }));
  }

  updateRouteOptimizationVehicles(vehicles: IVehicle[]): void {
    this.store.dispatch(ContextActions.updateRouteOptimizationVehicles({ vehicles }));
  }
}
