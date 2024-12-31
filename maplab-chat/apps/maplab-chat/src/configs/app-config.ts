import { InjectionToken } from '@angular/core';
import { CommonAppConfig, IAppConfigService } from './models/app-config.model';

export const APP_CONFIG = new InjectionToken<CommonAppConfig>('APP_CONFIG');
export const SHOW_DEV_FEATURE = new InjectionToken<boolean>('SHOW_DEV_FEATURE');

export const getConfig = <T>(appConfig: IAppConfigService<T>): T => {
  return appConfig.getConfig();
};

export const getAssistantApiUrl = (
  appConfig: IAppConfigService<CommonAppConfig>
): string | undefined => {
  return appConfig.getConfig().assistantApiUrl;
};

export const getDirectionsApiUrl = (
  appConfig: IAppConfigService<CommonAppConfig>,
): string | undefined => {
  return appConfig.getConfig().directionsApiUrl;
};