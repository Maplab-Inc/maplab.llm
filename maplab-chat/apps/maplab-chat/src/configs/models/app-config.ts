import { CommonAppConfig } from "./app-config.model";

export interface AppConfig extends CommonAppConfig {
  theme?: string;
  environmentName?: string;
  showDevFeature: boolean;
}
