import { Component } from '@angular/core';
import { LngLat, MapMouseEvent, Marker } from 'maplibre-gl';
import { MenuItem, MessageService } from 'primeng/api';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { ITruck } from '../../models/truck';
import { TrucksService } from '../../services/context-services/trucks-service';
import { IProduct } from '../../models/product';
import { OPTIMIZATION_PRODUCTS } from '../../constants/products.constants';

@Component({
  selector: 'maplab-chat-create-vehicle',
  templateUrl: './create-vehicle.component.html',
  styleUrl: './create-vehicle.component.scss',
  standalone: false
})
export class CreateVehicleComponent {
  markerFromTo: Marker[] = []
  loading!: boolean;

  zonesNumbers: number = 3;
  perMetre: number = 200;
  newTrunk!: ITruck;
  items: MenuItem[] = [];

  private coordinateMarker: Marker | null = null;

  constructor(private trucksService: TrucksService,
    private messageService: MessageService,
    private dialogRef: DynamicDialogRef,
  ) {
    this.initTruck();
    OPTIMIZATION_PRODUCTS.forEach((value: IProduct) => {
      this.items.push({
        label: value.name,
        command: () => {
          this.addCompartment(value);
        }
      });
    });
  }

  coordinateChange(): void {
    if (this.newTrunk.latitude && this.newTrunk.longitude) {

      if (this.coordinateMarker) {
        this.coordinateMarker.setLngLat({ lat: this.newTrunk.latitude, lng: this.newTrunk.longitude })
      } {
        this.onMapClick({ lngLat: new LngLat(this.newTrunk.longitude, this.newTrunk.latitude) } as MapMouseEvent);
      }
    }
  }

  onMapClick(event: MapMouseEvent & unknown): void {
    if (!this.coordinateMarker) {
      const imageTruck = document.createElement('img');
      imageTruck.width = 25;
      imageTruck.height = 40;
      imageTruck.src = '/assets/blue_marker.png';

      this.coordinateMarker = new Marker({ draggable: true, element: imageTruck, anchor: "bottom" })
        .setLngLat([event.lngLat.lng, event.lngLat.lat]);
      this.newTrunk.latitude = event.lngLat.lat;
      this.newTrunk.longitude = event.lngLat.lng;

      this.coordinateMarker.on('dragend', () => {
        const lngLat = this.coordinateMarker?.getLngLat() as LngLat;
        this.newTrunk.latitude = lngLat.lat;
        this.newTrunk.longitude = lngLat.lng;
      });

      this.markerFromTo = [this.coordinateMarker]
    } else {
      this.newTrunk.latitude = event.lngLat.lat;
      this.newTrunk.longitude = event.lngLat.lng;
      this.coordinateMarker.setLngLat({ lat: this.newTrunk.latitude, lng: this.newTrunk.longitude })
    }
  }

  onCreate(close?: boolean): void {
    this.trucksService.addTruck(this.newTrunk)
    this.messageService.add({ severity: 'success', summary: 'Truck added' });
    if (close) {
      this.dialogRef.close();
    } else {
      this.initTruck()
      this.markerFromTo = [];
      this.coordinateMarker?.remove();
      this.coordinateMarker = null;
    }
  }

  removeCompartment(index: number): void {
    this.newTrunk.compartments.splice(index, 1)
  }

  private initTruck(): void {
    this.newTrunk = {
      number: Math.floor(Math.random() * 10000),
      longitude: 0,
      latitude: 0,
      compartments: []
    }
  }


  private addCompartment(product: IProduct): void {
    this.newTrunk.compartments.push({
      capacity: 2000,
      load: 0,
      product: product
    })
  }
}

