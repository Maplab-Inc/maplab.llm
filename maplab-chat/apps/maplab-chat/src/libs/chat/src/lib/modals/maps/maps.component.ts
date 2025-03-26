import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
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
  GeoJSONSource,
  Map,
  FullscreenControl,
  Marker,
  MapMouseEvent,
  LngLatBounds,
  LayerSpecification,
} from 'maplibre-gl';
import { Coordinate } from '../../models/coordinate';
import { MapMarkerTagType } from '../../utils/map-to-marker';
import { MenuItem } from 'primeng/api';

enum MarkerIcon {
  truck = 'truck-icon',
  delivery = 'delivery-icon',
  marker = 'marker-icon',
}

interface IStyle {
  style: string;
  type: 'dark' | 'light';
}

@Component({
  selector: 'maplab-chat-maps',
  templateUrl: './maps.component.html',
  styleUrl: './maps.component.scss',
  standalone: false,
})
export class MapsComponent implements AfterViewInit {
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  @Input() set markers(markers: Feature<Point, GeoJsonProperties>[]) {
    this.markersFeatures = markers;
    this.changeMarkers(markers);
  }

  @Input({ required: true }) height!: string | number;
  @Input() set markersFromTo(markers: Marker[]) {
    this.markersFromToData = markers;
    markers.forEach((marker: Marker) => {
      marker.addTo(this.map);
    });
  }

  @Input() set isochroneData(isochrones: GeoJSON.GeoJSON | null) {
    this.isochronesData = isochrones;
    this.onIsochrones(isochrones);
  }

  @Input() set routes(routes: Feature<Geometry, GeoJsonProperties>[] | null) {
    this.routesData = routes;
    this.onRoutes(routes);
  }
  @Input() set cursorPointer(value: boolean) {
    this.cursorPointerValue = value;
    this.initCursorPointer();
  }

  @Input() set position(position: Coordinate) {
    this.centerOnPosition(position);
  }

  @Input() loading!: boolean;

  @Output() mapClick = new EventEmitter<MapMouseEvent & Object>();

  public markersFeatures!: Feature<Point, GeoJsonProperties>[];
  public currentStyle!: IStyle;
  stylesItems: MenuItem[] | undefined;

  private map!: Map;
  private currentMarkersLayers: string[] = [];
  private padding = 0.1;
  private initialState = { lng: -73.62, lat: 45.5, zoom: 14 };
  private cursorPointerValue = false;
  private mapIsLoaded!: boolean;
  private colors = [
    '#f54242',
    '#f542ce',
    '#c542f5',
    '#7b42f5',
    '#2f47fa',
    '#2fa9fa',
  ];

  private markersFromToData: Marker[] = [];
  private isochronesData: GeoJSON.GeoJSON | null = null;
  private routesData: Feature<Geometry, GeoJsonProperties>[] | null = null;
  imageDelivery!: HTMLImageElement;
  imageTruck!: HTMLImageElement;
  imageMarker!: HTMLImageElement;

  constructor() {
    if (localStorage.getItem('MapStyleV2')) {
      this.currentStyle = JSON.parse(
        localStorage.getItem('MapStyleV2') as string,
      ) as IStyle;
    } else {
      this.currentStyle = {
        style: 'https://tiles.maplab.ai/styles/maplab/style.json?key=LX.rlZ1yLh8hOBsM_XpMJYvQm2fCFaeX7i7Z7Mni5-j6AQ',
        type: 'dark',
      };
    }
    this.initMap();
    this.initStylesMenu();
  }

  ngAfterViewInit(): void {
    this.mapContainer.nativeElement.appendChild(this.map._container);
    this.map.resize();
  }

  private changeMarkers(
    markersFeatures: Feature<Point, GeoJsonProperties>[],
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
                  x.geometry.coordinates[0],
              ),
            ) + this.padding,
            Math.max(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[1],
              ),
            ) + this.padding,
            Math.min(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[0],
              ),
            ) - this.padding,
            Math.min(
              ...markersFeatures.map(
                (x: Feature<Point, GeoJsonProperties>) =>
                  x.geometry.coordinates[1],
              ),
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
                'z-index-1',
              );
              this.currentMarkersLayers.push(layerID);
            }
          },
        );

        if (markers.bbox) {
          var bounds = new LngLatBounds();
          markersFeatures.forEach((coord) =>
            bounds.extend({
              lng: coord.geometry.coordinates[0],
              lat: coord.geometry.coordinates[1],
            }),
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
  
  private initMap(): void {
    const mapContainer = document.createElement('div');
    mapContainer.classList.add('map');
    mapContainer.style.width = '100%';
    mapContainer.style.height = '100%';

    this.map = new Map({
      container: mapContainer,
      style: this.currentStyle.style,
      zoom: this.initialState.zoom,
      center: [-73.58216736, 45.49726821],
      attributionControl: false,
    });
    this.initCursorPointer();
    this.map.addControl(new FullscreenControl());

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
    this.imageMarker.src = '/assets/blue_marker.png';

    this.map.on('load', () => {
      if (!this.map.hasImage(MarkerIcon.delivery)) {
        this.map.addImage(MarkerIcon.delivery, this.imageDelivery);
      }

      if (!this.map.hasImage(MarkerIcon.truck)) {
        this.map.addImage(MarkerIcon.truck, this.imageTruck);
      }

      if (!this.map.hasImage(MarkerIcon.marker)) {
        this.map.addImage(MarkerIcon.marker, this.imageMarker);
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
        'z-index-1',
      );
      this.mapIsLoaded = true;
      this.changeMarkers(this.markersFeatures);
    });

    this.map.on('click', (event) => {
      this.mapClick.emit(event);
    });
  }

  private centerOnPosition(position: Coordinate | null): void {
    if (position) {
      this.map.fitBounds([
        [position.longitude + this.padding, position.latitude + this.padding],
        [position.longitude - this.padding, position.latitude - this.padding],
      ]);
    }
  }

  private onIsochrones(isochrones: GeoJSON.GeoJSON | null): void {
    if (this.map.getSource('isochroneSource')) {
      this.map.removeLayer('isochroneLayer');
      this.map.removeSource('isochroneSource');
      return;
    }

    if (!isochrones) {
      return;
    }

    if (this.map.getSource('isochroneSource')) {
      this.map.removeLayer('isochroneLayer');
      this.map.removeSource('isochroneSource');
    }

    const orderedisochrones = JSON.parse(
      JSON.stringify(isochrones),
    ) as FeatureCollection<Polygon, GeoJsonProperties>;

    orderedisochrones.features.reverse();

    this.map.addSource('isochroneSource', {
      type: 'geojson',
      data: orderedisochrones,
    });

    this.map.addLayer({
      id: 'isochroneLayer',
      type: 'fill',
      source: 'isochroneSource',
      paint: {
        ['fill-color']: [
          'match',
          ['get', 'value'],
          200,
          this.colors[0],
          400,
          this.colors[1],
          600,
          this.colors[2],
          800,
          this.colors[3],
          1000,
          this.colors[4],
          1200,
          this.colors[5],
          this.currentStyle.type === 'dark' ? '#ffffff' : '#000000',
        ],
        ['fill-outline-color']: 'rgb(255, 255, 255)',
        ['fill-opacity']: 0.3,
      },
    });
  }

  private onRoutes(
    routes: Feature<Geometry, GeoJsonProperties>[] | null,
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
              'z-index-0',
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

          const combinedBounds = bboxes.reduce(
            (bounds, bbox) => {
              return bounds
                .extend([bbox[0], bbox[1]])
                .extend([bbox[2], bbox[3]]);
            },
            new LngLatBounds(
              [bboxes[0][0], bboxes[0][1]],
              [bboxes[0][2], (bboxes[0] as number[])[3]],
            ),
          );

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
  private initCursorPointer(): void {
    if (this.map) {
      this.map.getCanvas().style.cursor = this.cursorPointerValue
        ? 'pointer'
        : '';
    }
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
                'light',
              );
            },
          },
          {
            label: 'Dark Matter',
            shortcut: 'assets/dark-matter.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/dark-matter-gl-style/style.json',
                'dark',
              );
            },
          },
          {
            label: 'Maplab - Night',
            shortcut: 'assets/Maplab-Night.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/maplab/style.json',
                'dark',
              );
            },
          },
          {
            label: 'OSM Bright',
            shortcut: 'assets/OSM-Bright.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/osm_bright/style.json',
                'light',
              );
            },
          },
          {
            label: 'OSM Liberty',
            shortcut: 'assets/OSM-Liberty.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/osm_bright/style.json',
                'light',
              );
            },
          },
          {
            label: 'Positron',
            shortcut: 'assets/Positron.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/positron/style.json',
                'light',
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

  private styleChanged(): void {
    if (this.mapIsLoaded) {
      this.imageTruck.src =
        this.currentStyle.type === 'dark'
          ? '/assets/truck_light.png'
          : '/assets/truck.png';
      if (!this.map.hasImage(MarkerIcon.delivery)) {
        this.map.addImage(MarkerIcon.delivery, this.imageDelivery);
      }

      if (!this.map.hasImage(MarkerIcon.truck)) {
        this.map.addImage(MarkerIcon.truck, this.imageTruck);
      } else {
        setTimeout(() => {
          this.map.updateImage(MarkerIcon.truck, this.imageTruck);
        }, 100);
      }

      if (!this.map.hasImage(MarkerIcon.marker)) {
        this.map.addImage(MarkerIcon.marker, this.imageMarker);
      }

      if (!this.map.getSource('empty')) {
        this.map.addSource('empty', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      if (!this.map.getLayer('z-index-1')) {
        this.map.addLayer({
          id: 'z-index-1',
          type: 'symbol',
          source: 'empty',
        });
      }

      if (!this.map.getLayer('z-index-0')) {
        this.map.addLayer(
          {
            id: 'z-index-0',
            type: 'symbol',
            source: 'empty',
          },
          'z-index-1',
        );
      }
      this.changeMarkers(this.markersFeatures);
      this.markersFromToData.forEach((marker: Marker) => {
        marker.addTo(this.map);
      });
      setTimeout(() => {
        if (this.isochronesData) {
          this.onIsochrones(this.isochronesData);
        }
        if (this.routesData?.length) {
          this.onRoutes(this.routesData);
        }
      }, 500);
    }
  }

  private changeStyle(): void {
    this.map.setStyle(this.currentStyle.style);
    localStorage.setItem('MapStyle', JSON.stringify(this.currentStyle));
    setTimeout(() => {
      this.styleChanged();
    }, 500);
  }
}
