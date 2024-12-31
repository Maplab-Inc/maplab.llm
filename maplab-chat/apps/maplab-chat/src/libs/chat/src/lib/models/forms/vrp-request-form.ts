import { Coordinate } from '../coordinate';
import { DispatchStatus } from '../dispatch-status';
import { CapacityMode } from '../enums/capacity-mode';
import { TrackMode } from '../enums/track-mode';
import { IProduct } from '../product';

export class VrpRequestForm {
  truckId: number = 0;
  truckName: string = '';
  truckNumber: number = 0;
  ticketsCount: number = 0;
  isOptimize: boolean = true;
  truckConstraints?: TruckConstraint;
  productsConstraints?: ProductConstraint;
  ticketsConstraints?: TicketConstraint;
}

export class TruckConstraint {
  trackMode: TrackMode | null = null;
  startLocation?: KnownLocation = KnownLocation.VehicleLocation;
  startLocationCoordinate?: Coordinate;
  endLocation?: KnownLocation = KnownLocation.VehicleLocation;
  endLocationCoordinate?: Coordinate;
}

export class ProductConstraint {
  capacityMode: CapacityMode | null = null;
  productsData?: ProductConstraintData[];
}

export class TicketConstraint {
  selectionMode: TicketSelectionMode = TicketSelectionMode.All;
  ticketConstraintInputs: TicketConstraintInput[] = [];
}

export class ProductConstraintData {
  product?: IProduct;
  load: number = 0;
  capacity: number = 0;
}

export class TicketConstraintInput {
  isOptimize: boolean = false;
  ticketNumber: number = 0;
  demand: number = 0;
  productName: string = '';
  status: DispatchStatus = DispatchStatus.OnTruck;
}

export enum TicketSelectionMode {
  All = 1,
  None = 2,
  Custom = 3,
}

export enum KnownLocation {
  VehicleLocation = 1,
  Depot = 2,
  Custom = 3,
}
