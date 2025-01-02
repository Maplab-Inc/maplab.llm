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

    on(ContextActions.editContext, (state, action) => ({
        ...state,
        routeOptimization: action.routeOptimizationContext
    })),

    on(ContextActions.err, (state) => ({
        ...state
    }))
);

export const getRouteOptimizationContext = (state: State): RouteOptimizationContext | null => state.routeOptimization;
