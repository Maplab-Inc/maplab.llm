import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Feature, GeoJsonProperties, Geometry, Point } from 'geojson';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { ICompartmentForm, IDispatchSaveForm, IRoutingModelForm } from '../../models/forms/dispatch-form';
import { TModelForm } from '../../models/forms/model-form';
import { IDeliveryRequest } from '../../models/delivery-request';
import { ITruck } from '../../models/truck';
import { TrucksService } from '../../services/context-services/trucks-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Coordinate } from '../../models/coordinate';
import { KnownLocation } from '../../models/forms/vrp-request-form';
import { TrackMode } from '../../models/enums/track-mode';
import { IVehicle, IVehicleProduct } from '../../models/vehicle';
import { IDemand } from '../../models/demand';
import { IContainer } from '../../models/container';
import { IJob } from '../../models/job';
import { CapacityMode } from '../../models/enums/capacity-mode';
import { ICompartment } from '../../models/compartment';
import { IProduct } from '../../models/product';
import { ContextFacade } from '../../+state/context/context.facade';
import { DeliveryRequestService } from '../../services/context-services/delivery-request-service';

@Component({
  selector: 'maplab-chat-optimization',
  templateUrl: './optimization.component.html',
  styleUrl: './optimization.component.scss',
  standalone: false,
})
export class OptimizationComponent implements OnInit {
  dispatchForm!: FormGroup<TModelForm<IDispatchSaveForm>>;
  dispatchFormSubmitted!: boolean;
  selectedRequests: IDeliveryRequest[] = [];
  loading!: boolean;
  selectedDeliveriesFeatures: Feature<Point, GeoJsonProperties>[] = [];
  routes: Feature<Geometry, GeoJsonProperties>[] = [];
  trucks: ITruck[] = [];
  selectedTimeLineTrackNumber!: number;

  constructor(
    private trucksService: TrucksService,
    private dialogRef: DynamicDialogRef,
    private destroyRef: DestroyRef,
    private contextFacade: ContextFacade,
    private deliveryRequestsService: DeliveryRequestService
  ) { }

  ngOnInit(): void {
    this.getTruck();
    this.genNewTruck();
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  returnTo(): void {
    this.selectedDeliveriesFeatures = [];
    this.routes = [];
  }

  private getTruck(): void {
    this.trucks = this.trucksService.getTrucks()
    this.initForm(this.trucks);
  }

  private genNewTruck(): void {
    this.trucksService.getNewTruck().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((newTruck: ITruck) => {
      this.trucks.push(newTruck);

      const newTruckFormGroup = this.createIRoutingModelForm(newTruck)
      this.dispatchForm.controls.models.push(newTruckFormGroup);
    })
  }

  private initForm(trucks: ITruck[]): void {
    this.dispatchForm = new FormGroup<TModelForm<IDispatchSaveForm>>({
      models: new FormArray<FormGroup<TModelForm<IRoutingModelForm>>>(
        trucks.map((truck: ITruck) => {
          return this.createIRoutingModelForm(truck);
        }),
      ),
    });
  }

  private createIRoutingModelForm(truck: ITruck): FormGroup<TModelForm<IRoutingModelForm>> {
    return new FormGroup<TModelForm<IRoutingModelForm>>({
      truck: new FormGroup<TModelForm<Partial<ITruck>>>({
        number: new FormControl<number>(truck.number, { nonNullable: true }),
        longitude: new FormControl<number>(truck.longitude, { nonNullable: true }),
        latitude: new FormControl<number>(truck.latitude, { nonNullable: true }),
      }),
      isOptimize: new FormControl<boolean>(true, { nonNullable: true }),
      title: new FormControl<string>(truck.name + ' # ' + truck.number + '(0)', { nonNullable: true }),
      trackMode: new FormControl<TrackMode>(TrackMode.ReturnTo, { nonNullable: true }),
      start: new FormControl<KnownLocation>(KnownLocation.VehicleLocation, { nonNullable: true }),
      customEnd: new FormControl<Coordinate | null>(null),
      customStart: new FormControl<Coordinate | null>(null),
      end: new FormControl<KnownLocation>(KnownLocation.VehicleLocation, { nonNullable: true }),
      capacity: new FormControl<CapacityMode>(CapacityMode.TruckLoad, { validators: [Validators.required] }),
      compartments: new FormArray(
        truck.compartments.map((compartment: ICompartment) => {
          return new FormGroup<TModelForm<ICompartmentForm>>({
            capacity: new FormControl<number>(compartment.capacity, { nonNullable: true }),
            load: new FormControl<number>(compartment.load, { nonNullable: true }),
            product: new FormGroup<TModelForm<IProduct>>({
              id: new FormControl<number>(compartment.product.id, { nonNullable: true }),
              name: new FormControl<string>(compartment.product.name, { nonNullable: true }),
              number: new FormControl<number>(compartment.product.number, { nonNullable: true }),
            }),
          });
        }),
      ),
    });
  }

  private mapToIVehicle(): IVehicle[] {
    return this.dispatchForm
      .getRawValue()
      .models.filter((value: IRoutingModelForm) => value.isOptimize)
      .map((routingModel: IRoutingModelForm) => {
        let start: Coordinate;
        if (routingModel.start === KnownLocation.VehicleLocation) {
          start = new Coordinate(routingModel.truck.longitude ?? 0, routingModel.truck.latitude ?? 0);
        } else {
          start = new Coordinate(routingModel.customStart?.longitude ?? 0, routingModel.customStart?.latitude ?? 0);
        }

        let end: Coordinate | undefined = undefined;
        if (routingModel.trackMode === TrackMode.ReturnTo) {
          if (routingModel.end === KnownLocation.VehicleLocation) {
            end = new Coordinate(routingModel.truck.longitude ?? 0, routingModel.truck.latitude ?? 0);
          } else if (routingModel.end === KnownLocation.Custom) {
            end = new Coordinate(routingModel.customEnd?.longitude ?? 0, routingModel.customEnd?.latitude ?? 0);
          }
        }

        const products: IVehicleProduct[] = routingModel.compartments.map((compartment: ICompartmentForm) => ({
          id: compartment.product.id as number, capacity: compartment.capacity, load: compartment.load
        }))

        return {
          id: routingModel.truck.number ?? 1,
          products,
          start,
          end,
          trackMode: routingModel.trackMode,
        };
      });
  }

  private mapToIJob(): IJob[] {
    return this.deliveryRequestsService.getDeliveryRequests().map((request: IDeliveryRequest) => {
      const demands: IDemand[] = request.destinationContainers.map((container: IContainer) => ({
        productId: container.product.id,
        quantity: container.requestedAmount
      }))

      return {
        id: request.purchaseOrder,
        location: {
          longitude: request.shipToAccount.longitude,
          latitude: request.shipToAccount.latitude,
        },
        demands: demands,
      };
    });
  }

  public saveContext(): void {
    const vehicles: IVehicle[] = this.mapToIVehicle();
    const jobs: IJob[] = this.mapToIJob();

    this.contextFacade.updateRouteOptimizationVehicles(vehicles);
    this.contextFacade.updateRouteOptimizationJobs(jobs);

    this.closeDialog();
  }
}
