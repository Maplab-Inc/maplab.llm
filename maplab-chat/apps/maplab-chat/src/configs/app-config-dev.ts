import { APP_CONFIG_BASE } from "./app-config-base";
import { AppConfig } from "./models/app-config";

export const APP_CONFIG_DEV: AppConfig = {
  ...APP_CONFIG_BASE,

  environmentName: 'dev',
  production: false,
  assistantApiUrl: 'http://127.0.0.1:5000',
  showDevFeature: true,
};
