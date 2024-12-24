export interface CommonAppConfig {
  assistantApiUrl: string;
  production: boolean;
}

export interface IAppConfigService<T> {
  setAppConfig(): void;
  getConfig(): T;
}
