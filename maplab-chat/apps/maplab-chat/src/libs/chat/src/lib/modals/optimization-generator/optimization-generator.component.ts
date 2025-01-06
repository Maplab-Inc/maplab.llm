import { Component } from '@angular/core';
import { RouteOptimizationGenerationService } from '../../services/context-services/route-optimization-generation.service';
import { finalize, forkJoin, tap } from 'rxjs';
import { IDeliveryRequest } from '../../models/delivery-request';
import { ITruck } from '../../models/truck';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

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
  loading: boolean = false;
  generatedDeliveryRequests: IDeliveryRequest[] = [];
  generatedVehicles: ITruck[] = [];

  constructor(private generatorService: RouteOptimizationGenerationService,
    private ref: DynamicDialogRef
  ) {
    this.regions = [
      { name: 'Quebec', code: 'Qc' },
      { name: 'Ontario', code: 'On' },
      { name: 'British Columbia', code: 'BC' },
    ];

    this.selectedRegion = this.regions[0];
  }

  generateContext() {
    let requests: { [key: string]: any } = {};

    if (this.genDeliveryRequest) {
      let deliveriesGenerationCount = this.requestGenCount;
      requests['deliveries'] =
        this.generatorService.generateOptimizationDeliveries({
          count: deliveriesGenerationCount,
        });
    }

    if (this.genVehicles) {
      let vehiclesGenerationCount = this.vehicleGenCount;
      requests['vehicles'] = this.generatorService.generateOptimizationVehicles(
        {
          count: vehiclesGenerationCount,
        }
      );
    }

    if (Object.keys(requests).length > 0) {
      this.loading = true;
      forkJoin(requests)
        .pipe(
          tap((results) => {
            if (results['deliveries']) {
              this.generatedDeliveryRequests = results['deliveries'] as IDeliveryRequest[];
            }
            if (results['vehicles']) {
              this.generatedVehicles = results['vehicles'] as ITruck[];
            }
          }),
          finalize(() => {
            this.loading = false;
            this.closeDialogWithResult();
          })
        )
        .subscribe();
    }
  }

  closeDialogWithResult() {
    const result = {
      generatedVehicles: this.generatedVehicles,
      generatedDeliveryRequests: this.generatedDeliveryRequests,
    };
    this.ref.close(result);
  }
}
