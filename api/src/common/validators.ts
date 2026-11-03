import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidCpf } from './cpf.js';

/** class-validator decorator: the value is a string holding a valid CPF. */
export function IsCpf(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCpf',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidCpf(value),
        defaultMessage: () => '$property must be a valid CPF',
      },
    });
}
