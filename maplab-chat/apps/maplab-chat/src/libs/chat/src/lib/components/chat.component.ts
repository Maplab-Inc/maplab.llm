import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Inject,
  Output,
  ViewChild,
} from '@angular/core';
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Point,
  Polygon,
} from 'geojson';
import {
  FullscreenControl,
  GeoJSONSource,
  GeolocateControl,
  LayerSpecification,
  LngLatBounds,
  Map,
  MapMouseEvent,
  NavigationControl,
  ScaleControl,
  TerrainControl,
} from 'maplibre-gl';
import { MenuItem } from 'primeng/api';
import { ChatFacade } from '../+state/chat/chat.facade';
import { AssistantCompletion } from '../models/assistant-completion';
import { IVehicleRoute, IVrpAssignment } from '../models/vrp-assignment';
import {
  IDirectionRequestDto,
  ResponseFormat,
} from '../models/directions-request';
import { forkJoin, map, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { IResponseError } from '../models/response-error';
import { GradientColors } from '../utils/gradient-colors';
import { IVehicle } from '../models/vehicle';
import { Coordinate } from '../models/coordinate';
import { TrackMode } from '../models/enums/track-mode';
import { DialogService } from 'primeng/dynamicdialog';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContextContainerComponent } from '../modals/context-container/context-container.component';
import { MapMarkerTagType } from '../utils/map-to-marker';
import { DIRECTIONS_API_URL } from '@maplab-chat/tokens';
import { ContextFacade } from '../+state/context/context.facade';
import { DeliveryRequestService } from '../services/context-services/delivery-request.service';
import { TrucksService } from '../services/context-services/trucks-service';

declare var require: any;

interface IStyle {
  style: string;
  type: 'dark' | 'light';
}

@Component({
  selector: 'maplab-chat-container',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  standalone: false,
})
export class ChatComponent implements AfterViewInit {
  userInput: string = '';
  messages: { content: string; sender: 'user' | 'ai' | 'loader' }[] = [];
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  @Output() mapClick = new EventEmitter<MapMouseEvent & Object>();

  public currentStyle!: IStyle;
  public height = '100vh';
  private map!: Map;
  private cursorPointerValue = false;
  private currentMarkersLayers: string[] = [];
  private padding = 0.1;
  private mapIsLoaded!: boolean;
  private initialState = { lng: -73.62, lat: 45.5, zoom: 14 };
  stylesItems: MenuItem[] | undefined;
  chatWidth: number = 30;
  mapWidth: number = 70;

  imageDelivery!: HTMLImageElement;
  imageTruck!: HTMLImageElement;
  imageMarker!: HTMLImageElement;

  constructor(
    public chatFacade: ChatFacade,
    private http: HttpClient,
    private dialogService: DialogService,
    private contextFacade: ContextFacade,
    private deliveryRequestService: DeliveryRequestService,
    private trucksService: TrucksService,
    @Inject(DIRECTIONS_API_URL) private directionsApiUrl: string
  ) {
    this.currentStyle = {
      style:
        'https://tiles.maplab.ai/styles/osm_liberty/style.json?key=LX.rlZ1yLh8hOBsM_XpMJYvQm2fCFaeX7i7Z7Mni5-j6AQ',
      type: 'dark',
    };
    this.initMap();
    this.initStylesMenu();

    this.chatFacade.chat$.subscribe({
      next: async (response: AssistantCompletion | null) => {
        if (response) {
          // Remove loader message
          this.messages.pop();

          // Add AI response to the chat
          this.messages.push({
            content: response.message || 'No response from AI.',
            sender: 'ai',
          });

          // Draw routes on the map
          let responseData = response.data;
          if (typeof response.data === 'string') {
            try {
              // If it's a string, try to parse it as JSON
              responseData = JSON.parse(response.data);
            } catch (e) {
              console.error('Invalid JSON string:', e);
            }
          }

          if (response.type === 'route_optimization') {
            let vrpAssignment = responseData as IVrpAssignment;
            let directionsRequests = this.createDirections(vrpAssignment);
            forkJoin(
              directionsRequests.map((directionsRequest) =>
                this.getDirections(directionsRequest)
              )
            ).subscribe({
              next: (results: Feature<Geometry, GeoJsonProperties>[]) => {
                this.onRoutes(results);
              },
              error: (err) => {
                console.error('Failed to fetch directions:', err);
              },
            });
          } else if (response.type === 'isochrone') {
            const sourceId = `isochrone_source_${Math.random()
              .toString(36)
              .substring(2, 10)}`;

            this.map.addSource(sourceId, {
              type: 'geojson',
              data: response.data as GeoJSON.FeatureCollection, // Use data directly
            });

            const colors = [
              '#440154',
              '#3B528B',
              '#21908D',
              '#5DC963',
              '#FDE725',
            ]; // Gradient colors for different isochrones

            (response.data as GeoJSON.FeatureCollection).features.forEach(
              (feature: any, index: number) => {
                if (
                  feature.geometry.type === 'Polygon' ||
                  feature.geometry.type === 'MultiPolygon'
                ) {
                  const fillLayerId = `isochrone-fill-layer-${index}`;
                  const outlineLayerId = `isochrone-outline-layer-${index}`;

                  this.map.addLayer({
                    id: fillLayerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                      'fill-color': colors[index % colors.length], // Cycle through colors
                      'fill-opacity': 0.4,
                    },
                  });

                  this.map.addLayer({
                    id: outlineLayerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                      'line-color': '#000',
                      'line-width': 1.5,
                    },
                    filter: ['==', ['id'], feature.id],
                  });

                  this.currentMarkersLayers.push(fillLayerId, outlineLayerId);
                }
              }
            );

            // Fit the map to the bounds of all isochrone polygons
            const bounds = new LngLatBounds();
            (response.data as GeoJSON.FeatureCollection).features.forEach(
              (feature: any) => {
                if (
                  feature.geometry.type === 'Polygon' ||
                  feature.geometry.type === 'MultiPolygon'
                ) {
                  feature.geometry.coordinates.forEach((ring: any) => {
                    ring.forEach((coord: any) => {
                      bounds.extend(coord);
                    });
                  });
                }
              }
            );

            this.map.fitBounds(bounds, {
              padding: { top: 20, bottom: 20, left: 20, right: 20 },
              maxZoom: 13,
            });
          } else if (response.type === 'overpass') {
            // convert json to geojson and display it on map.
            const osmtogeojsonModule = await import('osmtogeojson');
            const osmtogeojson = osmtogeojsonModule.default;
            let osmData = osmtogeojson(structuredClone(response.data));

            const sourceId = `osm_source_${Math.random()
              .toString(36)
              .substring(2, 10)}`;
            this.map.addSource(sourceId, {
              type: 'geojson',
              data: osmData,
            });

            const hasPolygons = osmData.features.some(
              (f) =>
                f.geometry.type === 'Polygon' ||
                f.geometry.type === 'MultiPolygon'
            );
            const hasPoints = osmData.features.some(
              (f) =>
                f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint'
            );
            const hasLines = osmData.features.some(
              (f) =>
                f.geometry.type === 'LineString' ||
                f.geometry.type === 'MultiLineString'
            );

            if (hasPoints) {
              const iconImage: MapMarkerTagType = MapMarkerTagType.marker;
              this.map.addLayer(
                {
                  id: 'symbol-layer',
                  type: 'symbol',
                  source: sourceId,
                  layout: {
                    ['icon-image']: iconImage,
                    ['icon-overlap']: 'always',
                    ['text-font']: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    ['text-size']: 11,
                    ['text-transform']: 'uppercase',
                    ['text-letter-spacing']: 0.05,
                    ['text-offset']: [0, 1.5],
                  },
                  paint: {
                    ['text-color']: '#202',
                    ['text-halo-color']: '#fff',
                    ['text-halo-width']: 2,
                  },
                },
                'z-index-1'
              );
              this.currentMarkersLayers.push('symbol-layer');

              var bounds = new LngLatBounds();

              osmData.features.forEach((feature: any) => {
                if (
                  feature.geometry.type === 'Polygon' ||
                  feature.geometry.type === 'MultiPolygon'
                ) {
                  feature.geometry.coordinates.forEach((ring: any) => {
                    ring.forEach((coord: any) => {
                      bounds.extend(coord);
                    });
                  });
                }
              });

              this.map.fitBounds(bounds, {
                padding: { top: 20, bottom: 20, left: 20, right: 20 },
                maxZoom: 15,
              });
            }
            if (hasPolygons) {
              this.map.addLayer({
                id: 'polygon-fill-layer',
                type: 'fill',
                source: sourceId,
                paint: {
                  'fill-color': '#088',
                  'fill-opacity': 0.5,
                },
              });
              this.currentMarkersLayers.push('polygon-fill-layer');

              // Add outline for polygons
              this.map.addLayer({
                id: 'polygon-outline-layer',
                type: 'line',
                source: sourceId,
                paint: {
                  'line-color': '#000',
                  'line-width': 2,
                },
              });
              this.currentMarkersLayers.push('polygon-outline-layer');
            }
            if (hasLines) {
              const colors = [
                '#ff6600',
                '#0099ff',
                '#33cc33',
                '#ffcc00',
                '#cc33ff',
              ]; // Five visible colors
              const randomColor =
                colors[Math.floor(Math.random() * colors.length)];

              this.map.addLayer({
                id: 'line-layer',
                type: 'line',
                source: sourceId,
                paint: {
                  'line-color': randomColor,
                  'line-width': 3,
                  'line-opacity': 0.8,
                },
              });

              this.currentMarkersLayers.push('line-layer');
            }
          }
        }
      },
      error: (error: any) => {
        console.error('Error:', error);
        this.messages.push({
          content: 'Failed to fetch response from server.',
          sender: 'ai',
        });
      },
    });
  }

  ngAfterViewInit(): void {
    this.mapContainer.nativeElement.appendChild(this.map._container);
    this.map.resize();

    const resizer = document.querySelector('.resizer') as HTMLElement;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const containerWidth =
        document.querySelector('.chat-container')!.clientWidth;
      const offsetX = e.clientX;
      const chatWidthPercent = (offsetX / containerWidth) * 100;
      const mapWidthPercent = 100 - chatWidthPercent;

      if (chatWidthPercent > 20 && mapWidthPercent > 20) {
        this.chatWidth = chatWidthPercent;
        this.mapWidth = mapWidthPercent;
      }
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = 'default';
    });
  }

  sendMessage(): void {
    if (!this.userInput.trim()) return;
    this.messages.push({ content: this.userInput, sender: 'user' });
    this.messages.push({ content: 'thinking...', sender: 'loader' });

    this.contextFacade.routeOptimizationContext$
      .pipe(
        map((routeOptimizationContext) => {
          if (routeOptimizationContext) {
            this.chatFacade.getCompletion({
              user: this.userInput,
              system: JSON.stringify(routeOptimizationContext),
            });
          } else {
            this.chatFacade.getCompletion({
              user: this.userInput,
            });
          }
        })
      )
      .subscribe();
    // Clear user input
    this.userInput = '';
  }

  private initMap(): void {
    const mapContainer = document.createElement('div');
    mapContainer.classList.add('map');
    mapContainer.style.width = '100%';
    mapContainer.style.height = '100vh';

    this.imageDelivery = document.createElement('img');
    this.imageDelivery.width = 25;
    this.imageDelivery.height = 25;
    this.imageDelivery.src = '/assets/delivery.png';

    this.imageTruck = document.createElement('img');
    this.imageTruck.width = 25;
    this.imageTruck.height = 25;
    this.imageTruck.src = '/assets/truck.svg';

    this.imageMarker = document.createElement('img');
    this.imageMarker.width = 25;
    this.imageMarker.height = 40;
    this.imageMarker.src = '/assets/green_marker.png';

    this.map = new Map({
      container: mapContainer,
      style: this.currentStyle.style,
      zoom: this.initialState.zoom,
      center: [-73.58216736, 45.49726821],
    });
    this.initCursorPointer();
    this.map.addControl(new FullscreenControl());
    this.map.addControl(new ScaleControl());
    this.map.addControl(
      new GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      'bottom-right'
    );
    this.map.addControl(
      new NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      })
    );

    this.map.on('load', () => {
      if (!this.map.hasImage(MapMarkerTagType.delivery)) {
        this.map.addImage(MapMarkerTagType.delivery, this.imageDelivery);
      }

      if (!this.map.hasImage(MapMarkerTagType.truck)) {
        this.map.addImage(MapMarkerTagType.truck, this.imageTruck);
      }

      if (!this.map.hasImage(MapMarkerTagType.marker)) {
        this.map.addImage(MapMarkerTagType.marker, this.imageMarker);
      }

      this.map.addSource('empty', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      this.map.addLayer({
        id: 'z-index-1',
        type: 'symbol',
        source: 'empty',
      });

      this.map.addLayer(
        {
          id: 'z-index-0',
          type: 'symbol',
          source: 'empty',
        },
        'z-index-1'
      );

      this.mapIsLoaded = true;

      // Add vehicles and delivery requests markers
      this.contextFacade.routeOptimizationContext$
        .pipe()
        .subscribe((routeOptimizationContext: any) => {
          if (routeOptimizationContext) {
            let markersFeatures: Feature<Point, GeoJsonProperties>[] = [];
            if (routeOptimizationContext.vehicles.length > 0) {
              markersFeatures = [
                ...this.trucksService.mapToGeoJson(
                  routeOptimizationContext.vehicles
                ),
              ];
            }

            if (routeOptimizationContext.jobs.length > 0) {
              markersFeatures = [
                ...markersFeatures,
                ...this.deliveryRequestService.mapToGeoJson(
                  routeOptimizationContext.jobs
                ),
              ];
            }

            if (markersFeatures.length > 0) {
              this.changeMarkers(markersFeatures);
            }
          }
        });
    });

    this.map.on('click', (event) => {
      this.mapClick.emit(event);
    });
  }

  private initStylesMenu(): void {
    this.stylesItems = [
      {
        label: 'Map Style',
        items: [
          {
            label: 'Basic preview',
            shortcut: 'assets/Basic-preview.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/basic-preview/style.json',
                'light'
              );
            },
          },
          {
            label: 'Dark Matter',
            shortcut: 'assets/dark-matter.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/dark-matter-gl-style/style.json',
                'dark'
              );
            },
          },
          {
            label: 'Maplab - Night',
            shortcut: 'assets/Maplab-Night.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/maplab/style.json',
                'dark'
              );
            },
          },
          {
            label: 'OSM Bright',
            shortcut: 'assets/OSM-Bright.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/osm_bright/style.json',
                'light'
              );
            },
          },
          {
            label: 'OSM Liberty',
            shortcut: 'assets/OSM-Liberty.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/osm_bright/style.json',
                'light'
              );
            },
          },
          {
            label: 'Positron',
            shortcut: 'assets/Positron.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/positron/style.json',
                'light'
              );
            },
          },
        ],
      },
    ];
  }

  private changeMapStyle(styleUrl: string, type: 'dark' | 'light'): void {
    this.currentStyle.style = styleUrl;
    this.currentStyle.type = type;
    this.changeStyle();
  }

  private changeStyle(): void {
    this.map.setStyle(this.currentStyle.style);
    localStorage.setItem('MapStyle', JSON.stringify(this.currentStyle));
    setTimeout(() => {}, 500);
  }

  private initCursorPointer(): void {
    if (this.map) {
      this.map.getCanvas().style.cursor = this.cursorPointerValue
        ? 'pointer'
        : '';
    }
  }

  private changeMarkers(
    markersFeatures: Feature<Point, GeoJsonProperties>[]
  ): void {
    if (this.mapIsLoaded) {
      this.currentMarkersLayers.forEach((l: string) => {
        if (this.map.getLayer(l)) {
          this.map.removeLayer(l);
        }
      });
      this.currentMarkersLayers = [];

      if (markersFeatures?.length > 0) {
        const markers: GeoJSON.GeoJSON = {
          type: 'FeatureCollection',
          features: markersFeatures,
          bbox: [
            Math.max(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[0]
              )
            ) + this.padding,
            Math.max(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[1]
              )
            ) + this.padding,
            Math.min(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[0]
              )
            ) - this.padding,
            Math.min(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[1]
              )
            ) - this.padding,
          ],
        };

        const sourceName = `mapMarkers_source`;
        const source = this.map.getSource(sourceName) as GeoJSONSource;
        if (source) {
          source.setData(markers);
        } else {
          this.map.addSource(sourceName, {
            type: 'geojson',
            data: markers,
          });
        }

        markers.features.forEach(
          (feature: Feature<Geometry, GeoJsonProperties>) => {
            const symbol =
              feature.properties !== null ? feature.properties['symbol'] : '';
            const id =
              feature.properties !== null ? feature.properties['id'] : '';
            const tag =
              feature.properties !== null ? feature.properties['tag'] : '';
            const layerID = 'tag-' + symbol + '-' + id;

            if (!this.map.getLayer(layerID)) {
              const iconImage: MapMarkerTagType = tag;
              this.map.addLayer(
                {
                  id: layerID,
                  type: 'symbol',
                  source: sourceName,
                  layout: {
                    // 'text-allow-overlap': true,
                    // 'text-ignore-placement': true,
                    // 'icon-allow-overlap': true,
                    // 'icon-ignore-placement': true,
                    ['icon-image']: iconImage,
                    ['icon-overlap']: 'always',
                    ['text-field']: symbol,
                    ['text-font']: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    ['text-size']: 11,
                    ['text-transform']: 'uppercase',
                    ['text-letter-spacing']: 0.05,
                    ['text-offset']: [0, 1.5],
                  },
                  paint: {
                    ['text-color']: '#202',
                    ['text-halo-color']: '#fff',
                    ['text-halo-width']: 2,
                  },
                  filter: ['==', 'symbol', symbol],
                },
                'z-index-1'
              );
              this.currentMarkersLayers.push(layerID);
            }
          }
        );

        if (markers.bbox) {
          var bounds = new LngLatBounds();
          markersFeatures.forEach((coord) =>
            bounds.extend({
              lng: coord.geometry.coordinates[0],
              lat: coord.geometry.coordinates[1],
            })
          );
          this.map.fitBounds(bounds, { padding: this.padding });
        }
      } else {
        const sourceName = `mapMarkers_source`;
        const source = this.map.getSource(sourceName);
        if (source) {
          this.map.removeSource(sourceName);
        }
      }
    }
  }

  createDirections(result: IVrpAssignment): IDirectionRequestDto[] {
    const request: IDirectionRequestDto[] = [];
    const colors = GradientColors.generateDegradationColors(
      result.vehicleRoutes.length
    );
    result.vehicleRoutes.forEach(
      (vehicleRoute: IVehicleRoute, index: number) => {
        this.contextFacade.routeOptimizationContext$
          .pipe()
          .subscribe((routeOptimizationContext: any) => {
            if (routeOptimizationContext) {
              let vehicle = routeOptimizationContext.vehicles.find(
                (vehicle: IVehicle) => vehicle.id === vehicleRoute.vehicleId
              );

              const lineColor = colors[index];
              // Vehicle START position
              if (vehicleRoute.visits.length && vehicle) {
                request.push({
                  direction: {
                    coordinates: [
                      [
                        (vehicle.start as Coordinate).longitude,
                        (vehicle.start as Coordinate)?.latitude,
                      ],
                      [
                        vehicleRoute.visits[0].nodeLocation.longitude,
                        vehicleRoute.visits[0].nodeLocation.latitude,
                      ],
                    ],
                    geometry: true,
                    routeResponseOptions: {
                      responseFromat: ResponseFormat.Geojson,
                    },
                  },
                  description: `${vehicle?.id} (${1})`,
                  lineColor,
                });
              }
              // Request position
              for (let index = 1; index < vehicleRoute.visits.length; index++) {
                request.push({
                  direction: {
                    coordinates: [
                      [
                        vehicleRoute.visits[index - 1].nodeLocation.longitude,
                        vehicleRoute.visits[index - 1].nodeLocation.latitude,
                      ],
                      [
                        vehicleRoute.visits[index].nodeLocation.longitude,
                        vehicleRoute.visits[index].nodeLocation.latitude,
                      ],
                    ],
                    geometry: true,
                    routeResponseOptions: {
                      responseFromat: ResponseFormat.Geojson,
                    },
                  },
                  description: `${vehicle?.id} (${index + 1})`,
                  lineColor,
                });
              }
            }
          });
      }
    );

    return request;
  }

  getDirections(
    body: IDirectionRequestDto
  ): Observable<Feature<Geometry, GeoJsonProperties>> {
    return this.http
      .post<Feature<Geometry, GeoJsonProperties>>(
        `${this.directionsApiUrl}router/directions`,
        body.direction,
        {
          headers: new HttpHeaders({
            'X-API-KEY': 'LX.rlZ1yLh8hOBsM_XpMJYvQm2fCFaeX7i7Z7Mni5-j6AQ',
          }),
        }
      )
      .pipe(
        map((result: Feature<Geometry, GeoJsonProperties> | IResponseError) => {
          const error = (result as IResponseError)?.error?.message;
          if (error) {
            this.showDirectionError(error);
            throw new Error(error);
          } else {
            if (
              result &&
              (result as Feature<Geometry, GeoJsonProperties>)?.properties !==
                null
            ) {
              (result as Feature<Geometry, GeoJsonProperties>).properties = {
                ...(result as Feature<Geometry, GeoJsonProperties>).properties,
                description: body.description,
                lineColor: body.lineColor,
              };
            }
            return result as Feature<Geometry, GeoJsonProperties>;
          }
        })
      );
  }

  private showDirectionError(errorMessage: string): void {
    console.error(errorMessage);
  }

  private onRoutes(
    routes: Feature<Geometry, GeoJsonProperties>[] | null
  ): void {
    if (routes?.length) {
      let routesCount = 0;

      let attempts = 0;
      const checkLoaded = setInterval(() => {
        attempts++;
        if (this.map.loaded() || attempts >= 3) {
          clearInterval(checkLoaded);
          if (!this.map.loaded() || routes.length === 0) {
            return;
          }

          routes.forEach((r: Feature<Geometry, GeoJsonProperties>) => {
            if (this.map.getSource(`routesSource_${routesCount}`)) {
              this.map.removeLayer(`routesLayer_${routesCount}`);
              this.map.removeLayer(`routesLayerDescription_${routesCount}`);
              this.map.removeSource(`routesSource_${routesCount}`);
            }

            const routesJson = JSON.parse(JSON.stringify(r)) as Feature<
              Geometry,
              GeoJsonProperties
            >;
            this.map.addSource(`routesSource_${routesCount}`, {
              type: 'geojson',
              data: routesJson,
            });
            const lineColor =
              !!routesJson.properties && routesJson.properties['lineColor']
                ? routesJson.properties['lineColor']
                : '#2fa9fa';

            this.map.addLayer(
              {
                id: `routesLayer_${routesCount}`,
                type: 'line',
                source: `routesSource_${routesCount}`,
                layout: {
                  ['line-join']: 'round',
                  ['line-cap']: 'round',
                },
                paint: {
                  ['line-color']: lineColor,
                  ['line-width']: 5,
                },
              },
              'z-index-0'
            );

            const description =
              routesJson.properties !== null
                ? routesJson.properties['description']
                : '';
            this.map.addLayer({
              id: `routesLayerDescription_${routesCount}`,
              type: 'symbol',
              source: `routesSource_${routesCount}`,
              layout: {
                'symbol-placement': 'line', // Ensures the text follows the line
                'text-field': description, // Get the 'description' property from the GeoJSON
                ['text-font']: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 17,
                'text-anchor': 'center',
              },
              paint: {
                'text-color': '#000000',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
              },
            });

            routesCount++;
          });

          const bboxes = routes
            .filter((route: GeoJSON.GeoJSON) => route.bbox !== undefined)
            .map((route: GeoJSON.GeoJSON) => {
              if (route.bbox?.length === 6) {
                route.bbox.splice(2, 1);
                route.bbox.splice(4, 1);
              }
              return route.bbox as [number, number, number, number];
            });

          const combinedBounds = bboxes.reduce((bounds, bbox) => {
            return bounds.extend([bbox[0], bbox[1]]).extend([bbox[2], bbox[3]]);
          }, new LngLatBounds([bboxes[0][0], bboxes[0][1]], [bboxes[0][2], (bboxes[0] as number[])[3]]));

          this.map.fitBounds(combinedBounds, {
            padding: 20, // Espace autour de la vue
            maxZoom: 15, // Zoom maximum
            duration: 1000, // Durée de l'animation en millisecondes
          });
        }
      }, 1000);
    } else if (this.map.getStyle()) {
      const sources = this.map.getStyle().sources;
      const layers = this.map.getStyle().layers;
      Object.keys(sources).forEach((key) => {
        if (key.startsWith('routesSource_')) {
          this.map.removeSource(key);
        }
      });
      layers.forEach((value: LayerSpecification) => {
        if (value.id.startsWith('routesLayer')) {
          this.map.removeLayer(value.id);
        }
      });
    }
  }

  openDemoModal(): void {
    const dialogRef = this.dialogService.open(ContextContainerComponent, {
      header: 'Route Optimization Context',
      width: '70%',
      height: '100%',
      closable: true,
      contentStyle: {
        ['overflow-y']: 'visible',
        ['background-color']: 'var(--surface-ground)',
      },
      style: { ['max-height']: '95%' },
    });
  }
}
