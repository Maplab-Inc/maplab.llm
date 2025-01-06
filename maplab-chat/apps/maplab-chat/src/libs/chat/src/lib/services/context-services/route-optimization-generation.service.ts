import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IDeliveryRequest } from '../../models/delivery-request';
import { ITruck } from '../../models/truck';
import { OptimizationGenerationRequest } from '../../models/optimization-generation-request';
import { SYSTEM_API_URL } from '@maplab-chat/tokens';

@Injectable()
export class RouteOptimizationGenerationService {
  constructor(
    private http: HttpClient,
    @Inject(SYSTEM_API_URL) private apiUrl: string
  ) {}

  generateOptimizationDeliveries(request: OptimizationGenerationRequest): Observable<IDeliveryRequest[]> {
    return this.http.get<IDeliveryRequest[]>(
      `${this.apiUrl}demo/deliveries?count=${request.count}`
    );
  }

  generateOptimizationVehicles(request: OptimizationGenerationRequest): Observable<ITruck[]> {
    return this.http.get<ITruck[]>(
      `${this.apiUrl}demo/trucks?count=${request.count}`
    );
  }
}
