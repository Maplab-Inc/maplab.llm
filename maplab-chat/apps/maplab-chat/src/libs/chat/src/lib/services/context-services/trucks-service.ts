import { Injectable } from '@angular/core';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import { Observable, Subject } from 'rxjs';
import { ITruck } from '../../models/truck';
import { MapMarkerTagType, MappingMaps } from '../../utils/map-to-marker';
import { IVehicle } from '../../models/vehicle';


@Injectable({
  providedIn: 'root',
})
export class TrucksService {

  private trucks: ITruck[] = [];
  private newTruck$ = new Subject<ITruck>();

  getTrucks(): ITruck[] {
    return [...this.trucks];
  }

  addTruck(truck: ITruck): void {
    this.trucks.push(truck);
    this.newTruck$.next(truck);
  }

  removeTruck(truckNumber: number): void {
    this.trucks = this.trucks.filter((item: ITruck) => item.number !== truckNumber);
  }

  getNewTruck(): Observable<ITruck> {
    return this.newTruck$.asObservable();
  }

  mapToGeoJson(requests: IVehicle[]): Feature<Point, GeoJsonProperties>[] {
    return requests.map((request: IVehicle) =>
      MappingMaps.convertToMarker(MapMarkerTagType.truck, request.id.toString(), request.start.longitude, request.start.latitude),
    );
  }
}
