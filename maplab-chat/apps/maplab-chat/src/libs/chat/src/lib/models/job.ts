import { Coordinate } from "./coordinate";
import { IDemand } from "./demand";

export interface IJob {
    id: number;
    location: Coordinate;
    demands: IDemand[];
    requiredSkills?: number[];
  }