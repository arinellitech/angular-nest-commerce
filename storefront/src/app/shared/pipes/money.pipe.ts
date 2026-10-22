import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../money';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined, currency = 'BRL'): string {
    return cents === null || cents === undefined ? '' : formatMoney(cents, currency);
  }
}
