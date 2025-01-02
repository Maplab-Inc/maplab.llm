import { IJob } from "./job";
import { IVehicle } from "./vehicle";

export interface RouteOptimizationContext {
    vehicles: IVehicle[];
    jobs: IJob[];
}