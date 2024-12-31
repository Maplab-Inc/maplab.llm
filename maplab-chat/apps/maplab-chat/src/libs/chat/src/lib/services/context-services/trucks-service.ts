import { Injectable } from '@angular/core';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import { Observable, Subject } from 'rxjs';
import { ITruck } from '../../models/truck';
import { MapMarkerTagType, MappingMaps } from '../../utils/map-to-marker';


@Injectable({
  providedIn: 'root',
})
export class TrucksService {

  private trucks: ITruck[] = [];
  private newTruck$ = new Subject<ITruck>();

  constructor() {
    if (localStorage.getItem("trucks")) {
      this.trucks = JSON.parse(localStorage.getItem("trucks") as string) as ITruck[];
    }
  }

  getTrucks(): ITruck[] {
    return [...this.trucks];
  }

  addTruck(truck: ITruck): void {
    this.trucks.push(truck);
    localStorage.setItem("trucks", JSON.stringify(this.trucks))
    this.newTruck$.next(truck);
  }

  removeTruck(truckNumber: number): void {
    this.trucks = this.trucks.filter((item: ITruck) => item.number !== truckNumber);
    localStorage.setItem("trucks", JSON.stringify(this.trucks))
  }

  getNewTruck(): Observable<ITruck> {
    return this.newTruck$.asObservable();
  }

  mapToGeoJson(requests: ITruck[]): Feature<Point, GeoJsonProperties>[] {
    return requests.map((request: ITruck) =>
      MappingMaps.convertToMarker(MapMarkerTagType.truck, request.number.toString(), request.longitude, request.latitude),
    );
  }
}
