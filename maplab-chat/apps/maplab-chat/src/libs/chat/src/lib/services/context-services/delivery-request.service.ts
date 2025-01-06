import { Injectable } from '@angular/core';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import { BehaviorSubject, Observable, Subject, map, take } from 'rxjs';
import { IDeliveryRequest } from '../../models/delivery-request';
import { MapMarkerTagType, MappingMaps } from '../../utils/map-to-marker';
import { IJob } from '../../models/job';
@Injectable({
  providedIn: 'root',
})
export class DeliveryRequestService {
  private deliveryRequests: IDeliveryRequest[] = [];
  private deliveryRequestsSubject$ = new BehaviorSubject<IDeliveryRequest[]>(
    this.deliveryRequests
  );

  getDeliveryRequestsSubject$(): Observable<IDeliveryRequest[]> {
    return this.deliveryRequestsSubject$.asObservable();
  }

  getDeliveryRequests(): IDeliveryRequest[] {
    return this.deliveryRequests;
  }

  addDeliveryRequest(request: IDeliveryRequest): void {
    request.lowestContainer = request.destinationContainers.reduce(
      (acc, value) => {
        return (acc =
          acc.requestedAmount > value.requestedAmount ? acc : value);
      },
      request.destinationContainers[0]
    );
    this.deliveryRequests.push(request);
    this.deliveryRequestsSubject$.next([...this.deliveryRequests]);
  }

  getRequests(): IDeliveryRequest[] {
    return this.deliveryRequests;
  }

  addRequest(request: IDeliveryRequest): void {
    if (
      this.deliveryRequests.find(
        (item: IDeliveryRequest) => item.id === request.id
      )
    ) {
      return;
    }

    this.deliveryRequests.push(request);
    this.deliveryRequestsSubject$.next([...this.deliveryRequests]);
  }

  removeRequest(request: IDeliveryRequest): void {
    this.deliveryRequests = this.deliveryRequests.filter(
      (item: IDeliveryRequest) => item.id !== request.id
    );
    this.deliveryRequestsSubject$.next([...this.deliveryRequests]);
  }

  updateRequests(request: IDeliveryRequest[]): void {
    this.deliveryRequests = request;
    this.deliveryRequestsSubject$.next([...this.deliveryRequests]);
  }

  removeAllRequests(): void {
    this.deliveryRequests = [];
    this.deliveryRequestsSubject$.next([...this.deliveryRequests]);
  }

  mapToGeoJson(requests: IJob[]): Feature<Point, GeoJsonProperties>[] {
    return requests.map((request: IJob) =>
      MappingMaps.convertToMarker(
        MapMarkerTagType.delivery,
        request.id.toString(),
        request.location.longitude,
        request.location.latitude
      )
    );
  }
}
