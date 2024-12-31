import { Component, Input, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TModelForm } from '../../models/forms/model-form';
import { IDispatchSaveForm, IRoutingModelForm } from '../../models/forms/dispatch-form';
import { DialogService } from 'primeng/dynamicdialog';
import { TrucksService } from '../../services/context-services/trucks-service';
import { TrackMode } from '../../models/enums/track-mode';
import { KnownLocation } from '../../models/forms/vrp-request-form';
import { Coordinate } from '../../models/coordinate';
import { CapacityMode } from '../../models/enums/capacity-mode';
import { IDefaultSelectListItem } from '../../models/forms/select-list-item';
import { SelectPositionComponent } from '../select-position/select-position.component';
import { CreateTruckComponent } from '../create-trunk/create-truck.component';
@Component({
    selector: 'maplab-chat-optimization-form',
    templateUrl: './optimization-form.component.html',
    styleUrl: './optimization-form.component.scss',
    standalone: false
})
export class OptimizationFormComponent implements OnInit {
    @Input({ required: true }) dispatchForm!: FormGroup<TModelForm<IDispatchSaveForm>>;
    @Input({ required: true }) formSubmitted!: boolean;

    trackModeOptions: IDefaultSelectListItem[] = [];
    knownLocationOptions: IDefaultSelectListItem[] = [];
    capacityModeOptions: IDefaultSelectListItem[] = [];

    constructor(
        private dialogService: DialogService,
        private trucksService: TrucksService
    ) { }

    ngOnInit(): void {
        this.initModesOptions();
    }

    openCreateTrunkModal(): void {
        this.dialogService.open(CreateTruckComponent, {
            header: 'Create vehicle',
            width: '95%',
            height: '95%',
            contentStyle: { ['overflow-y']: 'visible', ['background-color']: 'var(--surface-ground)' },
            style: { ['max-height']: '95%' },
        });
    }

    removeTrunk(index: number, model: FormGroup<TModelForm<IRoutingModelForm>>
    ): void {
        this.dispatchForm.controls.models.removeAt(index)
        this.trucksService.removeTruck(model.controls.truck?.controls?.number?.value as number)
    }

    onTrackModeChanged(model: FormGroup<TModelForm<IRoutingModelForm>>): void {
        if (model.controls.trackMode.value === TrackMode.RoundTrip || model.controls.trackMode.value === TrackMode.LastVisit) {
            model.controls.end?.disable()
        } else {
            model.controls.end?.enable()
        }
    }

    onStartPositionChanged(model: FormGroup<TModelForm<IRoutingModelForm>>): void {
        if (model.controls.start.value === KnownLocation.Custom) {
            const callBackFunction = (coordinate?: Coordinate): void => {
                if (coordinate) {
                    model.controls.customStart.setValue(coordinate);
                } else {
                    model.controls.start.setValue(KnownLocation.VehicleLocation)
                }
            }
            this.openSelectPositionModal("Start", model.controls.customStart.value, callBackFunction)
        } else {
            model.controls.customStart.setValue(null)
        }
    }

    onEndPositionChanged(model: FormGroup<TModelForm<IRoutingModelForm>>): void {
        if (model.controls.end.value === KnownLocation.Custom) {
            const callBackFunction = (coordinate?: Coordinate): void => {
                if (coordinate) {
                    model.controls.customEnd.setValue(coordinate);
                } else {
                    model.controls.end.setValue(KnownLocation.VehicleLocation)
                }
            }
            this.openSelectPositionModal("End", model.controls.customEnd.value, callBackFunction)
        } else {
            model.controls.customEnd.setValue(null)
        }
    }

    private openSelectPositionModal(returnValueInCancel: string, oldPosition: Coordinate | null, addCustomPosition: (coordinate?: Coordinate) => void): void {
        const dialogRef = this.dialogService.open(SelectPositionComponent, {
            header: 'Select position',
            width: '95%',
            height: '95%',
            contentStyle: { ['overflow-y']: 'visible', ['background-color']: 'var(--surface-ground)' },
            style: { ['max-height']: '95%' },
            data: {
                returnValueInCancel, oldPosition
            }
        });

        dialogRef.onClose.subscribe((coordinate: Coordinate) => {
            addCustomPosition(coordinate)
        })
    }

    private initModesOptions(): void {
        this.trackModeOptions = [
            {
                name: 'Round Trip',
                code: TrackMode.RoundTrip,
            },
            {
                name: 'Last Visit',
                code: TrackMode.LastVisit,
            },
            {
                name: 'Return To',
                code: TrackMode.ReturnTo,
            },
        ];

        this.knownLocationOptions = [
            {
                name: 'Vehicle Location',
                code: KnownLocation.VehicleLocation,
            },
            // {
            //     name: 'Depot',
            //     code: KnownLocation.Depot,
            // },
            {
                name: 'Custom',
                code: KnownLocation.Custom,
            },
        ];

        this.capacityModeOptions = [
            {
                name: 'Vehicle Load',
                code: CapacityMode.TruckLoad,
            },
            {
                name: 'Full',
                code: CapacityMode.Full,
            },
            {
                name: 'Empty',
                code: CapacityMode.Empty,
            },
            {
                name: 'Custom',
                code: CapacityMode.Custom,
            },
        ];
    }
}
