export interface IDirectionRequestDto {
  direction: IDirection;
  description: string;
  lineColor?: string;
}

export interface IDirection {
  coordinates: number[][];
  routeResponseOptions?: { responseFromat: ResponseFormat };
  geometry?: boolean;
  elevation?: boolean;
  geometrySimplify?: boolean;
  maneuvers?: boolean;
  suppressWarnings?: boolean;
  roundaboutExits?: boolean;
  extraInfo?: ExtraInfo[];
  aternativeRoutes?: AlternativeRoutes;
}

export enum ResponseFormat {
  Default = 0,
  Json = 1,
  Geojson = 2,
  Gpx = 3,
}

export enum ExtraInfo {
  Steepness,
  Suitability,
  Surface,
  WayCategory,
  WayType,
  Tollways,
  TrailDifficulty,
  Osmid,
  RoadAccessRestrictions,
  CountryInfo,
  Green,
  Noise,
  Csv,
  Shadow,
}

export interface AlternativeRoutes {
  routesCount?: number;
  weightFactor: number;
  shareFactor: number;
}
