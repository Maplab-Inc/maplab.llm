import { IProduct } from './product';

export interface IContainer {
  currentPercentage?: number;
  product: IProduct;
  requestedAmount: number;
}
