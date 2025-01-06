import { Component } from '@angular/core';

interface Region {
  name: string;
  code: string;
}

@Component({
  selector: 'maplab-chat-optimization-generator',
  templateUrl: './optimization-generator.component.html',
  styleUrls: ['./optimization-generator.component.scss'],
  standalone: false,
})
export class OptimizationGeneratorComponent {
  regions: Region[];
  selectedRegion: Region;
  genDeliveryRequest: boolean = true;
  requestGenCount: number = 25;
  genVehicles: boolean = true;
  vehicleGenCount: number = 7;

  constructor() {
    this.regions = [
      { name: 'Quebec', code: 'Qc' },
      { name: 'Ontario', code: 'On' },
      { name: 'British Columbia', code: 'BC' },
    ];

    this.selectedRegion = this.regions[0];
  }
}
