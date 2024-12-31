import { Coordinate } from "../coordinate";
import { CapacityMode } from "../enums/capacity-mode";
import { TrackMode } from "../enums/track-mode";
import { IProduct } from "../product";
import { ITruck } from "../truck";
import { KnownLocation } from "./vrp-request-form";

export interface IDispatchSaveForm {
  models: IRoutingModelForm[];
}

export interface IRoutingModelForm {
  truck: Partial<ITruck>;
  isOptimize: boolean;
  title: string;
  trackMode: TrackMode;
  start: KnownLocation;
  customStart: Coordinate | null;
  end: KnownLocation;
  customEnd: Coordinate | null;
  capacity: CapacityMode | null;
  compartments: ICompartmentForm[];
}

export interface ICompartmentForm {
  capacity: number;
  load: number;
  product: IProduct;
}
