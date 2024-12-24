import { APP_CONFIG_BASE } from "./app-config-base";
import { AppConfig } from "./models/app-config";

export const APP_CONFIG_PROD: AppConfig = {
  ...APP_CONFIG_BASE,

  environmentName: 'prod',
  production: true,
  assistantApiUrl: 'https://portal.api.maplab.ai/api',
  showDevFeature: false,
};
