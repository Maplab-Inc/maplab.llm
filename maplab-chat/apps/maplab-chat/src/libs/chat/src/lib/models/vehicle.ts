import { Coordinate } from './coordinate';
import { TrackMode } from './enums/track-mode';

export interface IVehicleProduct {
  id: number;
  capacity: number;
  load: number;
}

export interface IVehicle {
  id?: number;
  products: IVehicleProduct[];
  start?: Coordinate;
  end?: Coordinate;
  trackMode: TrackMode;
  skills?: number[];
  maxDrivingDistance?: number;
  maxDrivingTime?: number;
  averageDrivingSpeed?: number;
}
