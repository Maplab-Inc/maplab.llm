import { Injectable } from '@angular/core';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import { BehaviorSubject, Observable, Subject, map, take } from 'rxjs';
import { IDeliveryRequest } from '../../models/delivery-request';
import { MapMarkerTagType, MappingMaps } from '../../utils/map-to-marker';
@Injectable({
  providedIn: 'root',
})
export class DeliveryRequestService {
  private selectedRequests$ = new BehaviorSubject<IDeliveryRequest[]>([]);
  private newDeliveryRequest$ = new Subject<IDeliveryRequest>();
  private deliveryRequests: IDeliveryRequest[] = [];

  constructor() {
    if (localStorage.getItem("DeliveryRequests")) {
      this.deliveryRequests = JSON.parse(localStorage.getItem("DeliveryRequests") as string) as IDeliveryRequest[];
    }
  }

  getDeliveryRequests(): IDeliveryRequest[] {
    return this.deliveryRequests;
  }

  addDeliveryRequest(truck: IDeliveryRequest): void {
    truck.lowestContainer = truck.destinationContainers.reduce((acc, value) => {
      return (acc = acc.requestedAmount > value.requestedAmount ? acc : value);
    }, truck.destinationContainers[0]);
    this.deliveryRequests.push(truck);
    localStorage.setItem("DeliveryRequests", JSON.stringify(this.deliveryRequests))
    this.newDeliveryRequest$.next(truck);
  }

  getNewDeliveryRequest(): Observable<IDeliveryRequest> {
    return this.newDeliveryRequest$.asObservable();
  }

  getSelectedRequests(): Observable<IDeliveryRequest[]> {
    return this.selectedRequests$.asObservable();
  }

  getSelectedRequestsValue(): IDeliveryRequest[] {
    return this.selectedRequests$.getValue();
  }

  addSelectedRequest(request: IDeliveryRequest): void {
    this.selectedRequests$.next([request, ...this.selectedRequests$.value]);
  }

  removeRequest(requests: IDeliveryRequest[]): void {
    this.deliveryRequests = requests;
    localStorage.setItem("DeliveryRequests", JSON.stringify(this.deliveryRequests))
  }

  changeSelectedRequests(request: IDeliveryRequest[]): void {
    this.selectedRequests$.next(request);
  }

  removeAllRequestsFromSelection(): void {
    this.selectedRequests$.next([]);
  }

  mapToGeoJson(requests: IDeliveryRequest[]): Feature<Point, GeoJsonProperties>[] {
    return requests.map((request: IDeliveryRequest) =>
      MappingMaps.convertToMarker(
        MapMarkerTagType.delivery,
        request.purchaseOrder.toString(),
        request.shipToAccount.longitude,
        request.shipToAccount.latitude,
      ),
    );
  }
}
