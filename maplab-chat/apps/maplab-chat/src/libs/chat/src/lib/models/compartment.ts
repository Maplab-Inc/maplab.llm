import { IProduct } from "./product";

export interface ICompartment {
  id?: string;
  capacity: number;
  load: number;
  product: IProduct;
}
