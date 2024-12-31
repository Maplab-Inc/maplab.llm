import { FormArray, FormControl, FormGroup } from '@angular/forms';

export type TModelForm<T> = {
  [k in keyof T]: T[k] extends object
    ? T[k] extends Date
      ? FormControl<T[k]>
      : T[k] extends Array<any>
        ? FormArray<FormGroup<TModelForm<T[k][0]>>>
        : FormGroup<TModelForm<T[k]>>
    : FormControl<T[k]>;
};
