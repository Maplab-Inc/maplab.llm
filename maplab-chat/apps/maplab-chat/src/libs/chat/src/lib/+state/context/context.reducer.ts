import { createReducer, on } from "@ngrx/store";
import { RouteOptimizationContext } from "../../models/route-optimization-context";
import { ContextActions } from "./context.actions";

export interface State {
    routeOptimization: RouteOptimizationContext | null;
}

export const initialState: State = {
    routeOptimization: null
};

export const reducer = createReducer(
    initialState,

    on(ContextActions.updateRouteOptimizationJobs, (state, action) => ({
        ...state,
        routeOptimization: {
            ...state.routeOptimization,
            vehicles: state.routeOptimization?.vehicles ?? [],
            jobs: action.jobs
        }
    })),

    on(ContextActions.updateRouteOptimizationVehicles, (state, action) => ({
        ...state,
        routeOptimization: {
            ...state.routeOptimization,
            jobs: state.routeOptimization?.jobs ?? [],
            vehicles: action.vehicles
        }
    })),

    on(ContextActions.err, (state) => ({
        ...state
    }))
);

export const getRouteOptimizationContext = (state: State): RouteOptimizationContext | null => state.routeOptimization;
