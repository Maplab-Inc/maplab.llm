import { IAccount } from "./account";
import { IContainer } from "./container";

export interface IDeliveryRequest {
  id: number;
  purchaseOrder: number;
  shipToAccount: IAccount;
  destinationContainers: IContainer[];
  lowestContainer?: IContainer;
}
