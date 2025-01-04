import {
  Component,
  DestroyRef,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import { FilterService, SelectItem } from 'primeng/api';
import {
  Table,
  TableRowSelectEvent,
  TableRowUnSelectEvent,
} from 'primeng/table';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IDeliveryRequest } from '../../models/delivery-request';
import { DeliveryRequestService } from '../../services/context-services/delivery-request-service';
import { DialogService } from 'primeng/dynamicdialog';
import { IAccount } from '../../models/account';
import { IContainer } from '../../models/container';
import { IPrimengColumn } from '../../models/forms/primeng-column';
import { CreateRequestComponent } from '../create-request/create-request.component';

@Component({
  selector: 'maplab-chat-optimization-request-list',
  templateUrl: './optimization-request-list.component.html',
  styleUrl: './optimization-request-list.component.scss',
  standalone: false,
})
export class OptimizationRequestListComponent implements OnInit {
  allColumns: IPrimengColumn[] = [];
  deliveryRequests: IDeliveryRequest[] = [];
  accountFilterModeOptions: SelectItem[] = [];
  selectedRequests: IDeliveryRequest[] = [];

  readonly TAG_FILTER_CONTAINS_NAME = 'contains-tag-filter';
  readonly DISPATCH_STATUS_FILTER = 'dispatchStatus-filter';
  private readonly TAG_FILTER_EXACT_NAME = 'exact-match-tag-filter';
  private readonly ACCOUNT_FILTER_NAME = 'account-name-filter';
  constructor(
    private deliveryRequestService: DeliveryRequestService,
    private filterService: FilterService,
    private dialogService: DialogService,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.deliveryRequests = [
      ...this.deliveryRequestService.getDeliveryRequests(),
    ];
    this.selectedRequests = [
      ...this.deliveryRequestService.getDeliveryRequests(),
    ];

    this.genNewDeliveryRequest();
    this.initColumns();
    this.filterRegister();
    this.initColumnMatchModeOptions();
  }

  clear(table: Table): void {
    table.clear();
  }

  spread(items: IContainer[]): IContainer[] {
    return [...items];
  }

  openCreateTruckModal(): void {
    this.dialogService.open(CreateRequestComponent, {
      header: 'Create Customer Requests',
      width: '70%',
      height: '95%',
      closable: true,
      contentStyle: {
        ['overflow-y']: 'visible',
        ['background-color']: 'var(--surface-ground)',
      },
      style: { ['max-height']: '95%' },
    });
  }

  addSelectedRequest(event: TableRowSelectEvent): void {
    let request = event.data;
    this.deliveryRequestService.addRequest(request);
  }

  unSelectedRequest(event: TableRowUnSelectEvent): void {
    let request = event.data;
    this.deliveryRequestService.removeRequest(request);
  }

  removeSelectedRequests(): void {
    this.deliveryRequests = this.deliveryRequests.filter(
      (request) => !this.selectedRequests.includes(request)
    );

    this.deliveryRequestService.removeAllRequests();
  }

  private genNewDeliveryRequest(): void {
    this.deliveryRequestService
      .getNewDeliveryRequest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deliveryRequest: IDeliveryRequest) => {
        this.deliveryRequests.push(deliveryRequest);
        this.selectedRequests = [...this.selectedRequests, deliveryRequest];
      });
  }

  private initColumns(): void {
    this.allColumns = [
      {
        selector: 'purchaseOrder',
        field: 'purchaseOrder',
        header: 'Request id',
        sortCol: 'purchaseOrder',
        filterType: 'numeric',
      },
      {
        selector: 'shipToAccount',
        field: 'shipToAccount',
        header: 'Customer Id',
        sortCol: 'shipToAccount.name',
      },
      {
        selector: 'product',
        field: 'lowestContainer',
        header: 'Product',
        sortCol: 'lowestContainer.requestedAmount',
      },
    ];
  }

  private initColumnMatchModeOptions(): void {
    this.accountFilterModeOptions = [
      { label: 'Name', value: this.ACCOUNT_FILTER_NAME },
    ];
  }

  private filterRegister(): void {
    this.filterService.register(
      this.TAG_FILTER_CONTAINS_NAME,
      (value: string[], filter: string[]): boolean => {
        if (filter === undefined || filter === null || filter.length === 0) {
          return true;
        }

        if (value === undefined || value === null) {
          return false;
        }

        return filter.every((elem: string) => value.includes(elem));
      }
    );

    this.filterService.register(
      this.TAG_FILTER_EXACT_NAME,
      (value: string[], filter: string[]): boolean => {
        if (filter === undefined || filter === null || filter.length === 0) {
          return true;
        }

        if (value === undefined || value === null) {
          return false;
        }

        if (value.length === filter.length) {
          return value.every((element: string) => {
            if (filter.includes(element)) {
              return true;
            }

            return false;
          });
        }

        return false;
      }
    );

    this.filterService.register(
      this.ACCOUNT_FILTER_NAME,
      (value: IAccount, filter: string): boolean => {
        if (filter === undefined || filter === null) {
          return true;
        }

        if (value === undefined || value === null) {
          return false;
        }

        return value.name.toLowerCase().includes(filter.toLowerCase());
      }
    );

    this.filterService.register(
      this.DISPATCH_STATUS_FILTER,
      (value: string, filter: string): boolean => {
        if (filter === undefined || filter === null) {
          return true;
        }

        if (value === undefined || value === null) {
          return false;
        }

        return filter === value;
      }
    );
  }
}
