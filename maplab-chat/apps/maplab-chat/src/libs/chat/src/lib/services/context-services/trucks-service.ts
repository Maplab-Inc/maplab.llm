import { Injectable } from '@angular/core';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ITruck } from '../../models/truck';
import { MapMarkerTagType, MappingMaps } from '../../utils/map-to-marker';
import { IVehicle } from '../../models/vehicle';

@Injectable({
  providedIn: 'root',
})
export class TrucksService {
  private trucks: ITruck[] = [];
  private truckSubject$ = new BehaviorSubject<ITruck[]>(this.trucks);

  getTrucks(): ITruck[] {
    return [...this.trucks];
  }

  addTruck(truck: ITruck): void {
    this.trucks.push(truck);
    this.truckSubject$.next([...this.trucks]);

  }

  updateTrucks(trucks: ITruck[]): void {
    this.trucks = trucks;
    this.truckSubject$.next([...this.trucks]);
  }

  removeTruck(truckNumber: number): void {
    this.trucks = this.trucks.filter(
      (item: ITruck) => item.number !== truckNumber
    );
    this.truckSubject$.next([...this.trucks]);
  }

  getTruckSubject$(): Observable<ITruck[]> {
    return this.truckSubject$.asObservable();
  }

  mapToGeoJson(requests: IVehicle[]): Feature<Point, GeoJsonProperties>[] {
    return requests.map((request: IVehicle) =>
      MappingMaps.convertToMarker(
        MapMarkerTagType.truck,
        request.id.toString(),
        request.start.longitude,
        request.start.latitude
      )
    );
  }
}
