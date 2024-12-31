export interface CommonAppConfig {
  assistantApiUrl: string;
  directionsApiUrl: string;
  production: boolean;
}

export interface IAppConfigService<T> {
  setAppConfig(): void;
  getConfig(): T;
}
