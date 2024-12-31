import { Feature, GeoJsonProperties, Point } from 'geojson';

export enum MapMarkerTagType {
  delivery = 'delivery',
  truck = 'truck',
  marker = 'marker'
}
export class MappingMaps {
  static convertToMarker(
    tagType: MapMarkerTagType,
    symbol: string,
    longitude: number,
    latitude: number,
  ): Feature<Point, GeoJsonProperties> {
    return {
      type: 'Feature',
      properties: {
        tag: tagType,
        symbol: symbol,
        id: Math.floor(Math.random() * 10000)
      },
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    };
  }
}
