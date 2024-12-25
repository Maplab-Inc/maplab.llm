import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { FullscreenControl, Map, MapMouseEvent } from 'maplibre-gl';
import { MenuItem } from 'primeng/api';
import { ChatFacade } from '../+state/chat.facade';

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
  messages: { content: string; sender: 'user' | 'ai' }[] = [];
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  @Output() mapClick = new EventEmitter<MapMouseEvent & Object>();

  private map!: Map;
  public currentStyle!: IStyle;
  private cursorPointerValue = false;
  private mapIsLoaded!: boolean;
  private initialState = { lng: -73.62, lat: 45.5, zoom: 14 };
  stylesItems: MenuItem[] | undefined;
  chatWidth: number = 30;
  mapWidth: number = 70;

  constructor(private chatFacade: ChatFacade) {
    if (localStorage.getItem('MapStyleV2')) {
      this.currentStyle = JSON.parse(
        localStorage.getItem('MapStyleV2') as string
      ) as IStyle;
    } else {
      this.currentStyle = {
        style:
          'https://tiles.maplab.ai/styles/osm_liberty/style.json?key=LX.EHWNMgxtK7sH05CiZTjRGWMuRa-618h9z_x93EoH3e0',
        type: 'dark',
      };
    }
    this.initMap();
    this.initStylesMenu();
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
        console.log(this.chatWidth, this.mapWidth);
      }
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = 'default';
    });
  }

  sendMessage(): void {
    if (this.userInput.trim()) {
      this.messages.push({ content: this.userInput, sender: 'user' });

      // Clear user input
      this.userInput = '';

      this.chatFacade.getCompletion({ user: this.userInput });

      // Simulate AI response after a short delay
      setTimeout(() => {
        this.messages.push({
          content:
            'This is a long GIS AI response that can also plot some data on the map. ',
          sender: 'ai',
        });
      }, 500);
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
            shortcut: 'assets/demo/Basic-preview.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/basic-preview/style.json',
                'light'
              );
            },
          },
          {
            label: 'Dark Matter',
            shortcut: 'assets/demo/dark-matter.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/dark-matter-gl-style/style.json',
                'dark'
              );
            },
          },
          {
            label: 'Maplab - Night',
            shortcut: 'assets/demo/Maplab-Night.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/maplab/style.json',
                'dark'
              );
            },
          },
          {
            label: 'OSM Bright',
            shortcut: 'assets/demo/OSM-Bright.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/osm_bright/style.json',
                'light'
              );
            },
          },
          {
            label: 'OSM Liberty',
            shortcut: 'assets/demo/OSM-Liberty.png',
            command: () => {
              this.changeMapStyle(
                'https://tiles.maplab.ai/styles/osm_bright/style.json',
                'light'
              );
            },
          },
          {
            label: 'Positron',
            shortcut: 'assets/demo/Positron.png',
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
}
