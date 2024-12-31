import { Component, OnInit } from '@angular/core';
import { LngLat, MapMouseEvent, Marker } from 'maplibre-gl';
import { DialogService, DynamicDialogComponent, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Coordinate } from '../../models/coordinate';

@Component({
  selector: 'maplab-chat-select-position',
  templateUrl: './select-position.component.html',
  styleUrl: './select-position.component.scss',
  standalone: false
})
export class SelectPositionComponent implements OnInit {
  markerFromTo: Marker[] = []
  coordinate: Coordinate = new Coordinate(0, 0);

  returnValueInCancel!: string

  private coordinateMarker: Marker | null = null;
  private instance: DynamicDialogComponent | undefined;
  constructor(
    private dialogRef: DynamicDialogRef,
    private dialogService: DialogService
  ) {
    this.instance = this.dialogService.getInstance(this.dialogRef);
  }

  ngOnInit() {
    if (this.instance && this.instance.data) {
      this.returnValueInCancel = this.instance.data['returnValueInCancel'];
      const oldPosition = this.instance.data['oldPosition'] as Coordinate
      if (oldPosition) {
        const lngLat = { lat: oldPosition.latitude, lng: oldPosition.longitude } as LngLat
        this.onMapClick({ lngLat } as MapMouseEvent)
      };
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
      this.coordinate.latitude = event.lngLat.lat;
      this.coordinate.longitude = event.lngLat.lng;

      this.coordinateMarker.on('dragend', () => {
        const lngLat = this.coordinateMarker?.getLngLat() as LngLat;
        this.coordinate.latitude = lngLat.lat;
        this.coordinate.longitude = lngLat.lng;
      });

      this.markerFromTo = [this.coordinateMarker]
    } else {
      this.coordinate.latitude = event.lngLat.lat;
      this.coordinate.longitude = event.lngLat.lng;
      this.coordinateMarker.setLngLat({ lat: this.coordinate.latitude, lng: this.coordinate.longitude })
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.coordinate);
  }
}
