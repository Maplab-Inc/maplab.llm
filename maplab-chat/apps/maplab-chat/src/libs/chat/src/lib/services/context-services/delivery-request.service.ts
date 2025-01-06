import { Injectable } from '@angular/core';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import { Observable, Subject, map, take } from 'rxjs';
import { IDeliveryRequest } from '../../models/delivery-request';
import { MapMarkerTagType, MappingMaps } from '../../utils/map-to-marker';
import { IJob } from '../../models/job';
@Injectable({
  providedIn: 'root',
})
export class DeliveryRequestService {
  private newDeliveryRequest$ = new Subject<IDeliveryRequest>();
  private deliveryRequests: IDeliveryRequest[] = [];

  getDeliveryRequests(): IDeliveryRequest[] {
    return this.deliveryRequests;
  }

  addDeliveryRequest(request: IDeliveryRequest): void {
    request.lowestContainer = request.destinationContainers.reduce((acc, value) => {
      return (acc = acc.requestedAmount > value.requestedAmount ? acc : value);
    }, request.destinationContainers[0]);
    this.deliveryRequests.push(request);
    this.newDeliveryRequest$.next(request);
  }

  getNewDeliveryRequest(): Observable<IDeliveryRequest> {
    return this.newDeliveryRequest$.asObservable();
  }

  getRequests(): IDeliveryRequest[] {
    return this.deliveryRequests;
  }

  addRequest(request: IDeliveryRequest): void {
    if (this.deliveryRequests.find((item: IDeliveryRequest) => item.id === request.id)) {
      return;
    }
    
    this.deliveryRequests.push(request);
  }

  removeRequest(request: IDeliveryRequest): void {
    this.deliveryRequests = this.deliveryRequests.filter((item: IDeliveryRequest) => item.id !== request.id);
  }

  updateRequests(request: IDeliveryRequest[]): void {
    this.deliveryRequests = request;
  }

  removeAllRequests(): void {
    this.deliveryRequests = [];
  }

  mapToGeoJson(requests: IJob[]): Feature<Point, GeoJsonProperties>[] {
    return requests.map((request: IJob) =>
      MappingMaps.convertToMarker(
        MapMarkerTagType.delivery,
        request.id.toString(),
        request.location.longitude,
        request.location.latitude,
      ),
    );
  }
}
