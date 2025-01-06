export interface CommonAppConfig {
  assistantApiUrl: string;
  directionsApiUrl: string;
  systemApiUrl: string;
  production: boolean;
}

export interface IAppConfigService<T> {
  setAppConfig(): void;
  getConfig(): T;
}
