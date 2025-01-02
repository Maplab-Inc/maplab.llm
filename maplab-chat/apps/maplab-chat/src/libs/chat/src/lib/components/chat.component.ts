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
import { Feature, GeoJsonProperties, Geometry, Point, Polygon } from 'geojson';
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
import { HttpClient } from '@angular/common/http';
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

interface IStyle {
  style: string;
  type: 'dark' | 'light';
}

enum MarkerIcon {
  truck = 'truck-icon',
  delivery = 'delivery-icon',
  marker = 'marker-icon',
}

@Component({
  selector: 'maplab-chat-container',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  standalone: false,
})
export class ChatComponent implements AfterViewInit {
  vehicles: IVehicle[] = [
    {
      id: 1,
      products: [
        { id: 1, capacity: 6000, load: 6000 }, // Gas
        { id: 2, capacity: 3000, load: 3000 }, // Furnace
      ],
      start: new Coordinate(-73.58600425999558, 45.498870952285614),
      trackMode: TrackMode.RoundTrip,
    },
    {
      id: 2,
      products: [
        { id: 3, capacity: 5000, load: 5000 }, // Gas
        { id: 4, capacity: 8000, load: 8000 }, // Diesel
      ],
      start: new Coordinate(-73.44073664, 45.59886575),
      trackMode: TrackMode.LastVisit,
    },
    {
      id: 3,
      products: [
        { id: 5, capacity: 5000, load: 5000 }, // Gas
        { id: 6, capacity: 4400, load: 4400 }, // Furnace
      ],
      start: new Coordinate(-73.43386911, 45.36413691),
      trackMode: TrackMode.ReturnTo,
    },
    {
      id: 4,
      products: [
        { id: 7, capacity: 10000, load: 10000 }, // Gas
        { id: 8, capacity: 5000, load: 5000 }, // Furnace
        { id: 9, capacity: 5000, load: 5000 }, // Diesel
      ],
      start: new Coordinate(-73.58033876, 45.5024504),
      trackMode: TrackMode.RoundTrip,
    },
  ];

  userInput: string = '';
  messages: { content: string; sender: 'user' | 'ai' | 'loader' }[] = [];
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  @Output() mapClick = new EventEmitter<MapMouseEvent & Object>();

  public currentStyle!: IStyle;
  public height = '100vh';
  private map!: Map;
  private cursorPointerValue = false;
  private currentMarkersLayers: string[] = [];
  public markersFeatures!: Feature<Point, GeoJsonProperties>[];
  private padding = 0.1;
  private mapIsLoaded!: boolean;
  private initialState = { lng: -73.62, lat: 45.5, zoom: 14 };
  stylesItems: MenuItem[] | undefined;
  chatWidth: number = 30;
  mapWidth: number = 70;
  private colors = [
    '#f54242',
    '#f542ce',
    '#c542f5',
    '#7b42f5',
    '#2f47fa',
    '#2fa9fa',
  ];

  constructor(
    public chatFacade: ChatFacade,
    private http: HttpClient,
    private dialogService: DialogService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private destroyRef: DestroyRef,
    private contextFacade: ContextFacade,
    @Inject(DIRECTIONS_API_URL) private directionsApiUrl: string
  ) {
    this.currentStyle = {
      style:
        'https://tiles.maplab.ai/styles/osm_liberty/style.json?key=LX.EHWNMgxtK7sH05CiZTjRGWMuRa-618h9z_x93EoH3e0',
      type: 'dark',
    };
    this.initMap();
    this.initStylesMenu();

    this.chatFacade.chat$.subscribe({
      next: (response: AssistantCompletion | null) => {
        if (response) {
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

          // Now safely cast to IVrpAssignment
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
          debugger;
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
      this.changeMarkers(this.markersFeatures);
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
              const iconImage: MarkerIcon = this.getMarkerIcon(tag);
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

  private getMarkerIcon(marker: MapMarkerTagType): MarkerIcon {
    switch (marker) {
      case MapMarkerTagType.marker:
        return MarkerIcon.marker;
      case MapMarkerTagType.delivery:
        return MarkerIcon.delivery;
      case MapMarkerTagType.truck:
        return MarkerIcon.truck;
      default:
        return MarkerIcon.marker;
    }
  }

  createDirections(result: IVrpAssignment): IDirectionRequestDto[] {
    const request: IDirectionRequestDto[] = [];
    const colors = GradientColors.generateDegradationColors(
      result.vehicleRoutes.length
    );
    result.vehicleRoutes.forEach(
      (vehicleRoute: IVehicleRoute, index: number) => {
        const vehicle = this.vehicles.find(
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
    );

    return request;
  }

  getDirections(
    body: IDirectionRequestDto
  ): Observable<Feature<Geometry, GeoJsonProperties>> {
    return this.http
      .post<Feature<Geometry, GeoJsonProperties>>(
        `${this.directionsApiUrl}router/directions`,
        body.direction
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

    dialogRef.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      });
  }
}
