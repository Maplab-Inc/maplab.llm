import { Component } from '@angular/core';
import { LngLat, MapMouseEvent, Marker } from 'maplibre-gl';
import { MessageService } from 'primeng/api';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { IDeliveryRequest } from '../../models/delivery-request';
import { DeliveryRequestService } from '../../services/context-services/delivery-request-service';
import { OPTIMIZATION_PRODUCTS } from '../../constants/products.constants';

@Component({
  selector: 'maplab-chat-create-request',
  templateUrl: './create-request.component.html',
  styleUrl: './create-request.component.scss',
  standalone: false,
})
export class CreateRequestComponent {

  markerFromTo: Marker[] = []
  loading!: boolean;

  zonesNumbers: number = 3;
  perMetre: number = 200;
  newDeliveryRequest!: IDeliveryRequest;

  private coordinateMarker: Marker | null = null;

  constructor(
    private messageService: MessageService,
    private dialogRef: DynamicDialogRef,
    private deliveryRequestService: DeliveryRequestService
  ) {
    this.initRequest()
  }

  coordinateChange(): void {
    if (this.newDeliveryRequest.shipToAccount.latitude && this.newDeliveryRequest.shipToAccount.longitude) {

      if (this.coordinateMarker) {
        this.coordinateMarker.setLngLat({ lat: this.newDeliveryRequest.shipToAccount.latitude, lng: this.newDeliveryRequest.shipToAccount.longitude })
      } {
        this.onMapClick({ lngLat: new LngLat(this.newDeliveryRequest.shipToAccount.longitude, this.newDeliveryRequest.shipToAccount.latitude) } as MapMouseEvent);
      }
    }
  }

  onMapClick(event: MapMouseEvent & unknown): void {
    if (!this.coordinateMarker) {
      const imageRequest = document.createElement('img');
      imageRequest.width = 25;
      imageRequest.height = 40;
      imageRequest.src = '/assets/blue_marker.png';

      this.coordinateMarker = new Marker({ draggable: true, element: imageRequest, anchor: "bottom" })
        .setLngLat([event.lngLat.lng, event.lngLat.lat]);
      this.newDeliveryRequest.shipToAccount.latitude = event.lngLat.lat;
      this.newDeliveryRequest.shipToAccount.longitude = event.lngLat.lng;

      this.coordinateMarker.on('dragend', () => {
        const lngLat = this.coordinateMarker?.getLngLat() as LngLat;
        this.newDeliveryRequest.shipToAccount.latitude = lngLat.lat;
        this.newDeliveryRequest.shipToAccount.longitude = lngLat.lng;
      });

      this.markerFromTo = [this.coordinateMarker]
    } else {
      this.newDeliveryRequest.shipToAccount.latitude = event.lngLat.lat;
      this.newDeliveryRequest.shipToAccount.longitude = event.lngLat.lng;
      this.coordinateMarker.setLngLat({ lat: this.newDeliveryRequest.shipToAccount.latitude, lng: this.newDeliveryRequest.shipToAccount.longitude })
    }
  }

  onCreate(close?: boolean): void {
    this.deliveryRequestService.addDeliveryRequest(this.newDeliveryRequest);
    this.messageService.add({ severity: 'success', summary: 'Request added' });
    if (close) {
      this.dialogRef.close();
    } else {
      this.initRequest()
      this.markerFromTo = [];
      this.coordinateMarker?.remove();
      this.coordinateMarker = null;
    }
  }

  private initRequest(): void {
    this.newDeliveryRequest = {
      id: Math.floor(Math.random() * 10000),
      purchaseOrder: Math.floor(Math.random() * 100000),
      shipToAccount: {
        longitude: 0,
        latitude: 0,
        name: ""
      },
      destinationContainers: [
        {
          requestedAmount: 1000,
          product: OPTIMIZATION_PRODUCTS[0]
        }, {
          requestedAmount: 0,
          product: OPTIMIZATION_PRODUCTS[1]
        }, {
          requestedAmount: 0,
          product: OPTIMIZATION_PRODUCTS[2]
        },
      ]
    }
  }
}
