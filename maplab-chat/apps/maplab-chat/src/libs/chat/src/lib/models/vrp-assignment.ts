import { Coordinate } from "./coordinate";
import { IDemand } from "./demand";

export interface IVrpAssignment {
  vehicleRoutes: IVehicleRoute[];
  totalDistance: number;
  totalLoads: IDemand[];
  objective?: number;
  droppedOrders?: number[];
  droppedReloads?: number[];
}

export interface IVehicleRoute {
  vehicleId: number;
  visits: IVisit[];
  totalRouteDistance: number;
  totalRouteLoads: IDemand[];
}

export interface IVisit {
  order: number;
  nodeIndex: number;
  nodeId: number;
  nodeLocation: Coordinate;
  loadsOnVisit: IDemand[];
}
