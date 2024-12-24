import { Injectable } from '@angular/core';
import { AppConfig } from './models/app-config';
import { APP_CONFIG_DEV } from './app-config-dev';
import { APP_CONFIG_PROD } from './app-config-prod';

@Injectable()
export class AppConfigService {
  private _appConfig!: AppConfig;

  constructor() {
    this.setAppConfig();
  }

  setAppConfig(): void {
    const hostname = window.location.hostname;

    switch (hostname) {
      case 'localhost':
        this._appConfig = APP_CONFIG_DEV;
        break;
      case 'portal.maplab.ai':
        this._appConfig = APP_CONFIG_PROD;

        console.log('AppConfigService: ', this._appConfig);
        break;
      default:
        this._appConfig = APP_CONFIG_DEV;
        break;
    }
  }

  getConfig(): AppConfig {
    return this._appConfig;
  }
}
