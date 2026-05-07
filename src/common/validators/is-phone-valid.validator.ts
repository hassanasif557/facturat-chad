import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { parsePhoneNumberFromString } from 'libphonenumber-js';

@ValidatorConstraint({ name: 'isPhoneValid', async: false })
export class IsPhoneValid implements ValidatorConstraintInterface {
  validate(phone: string) {
    try {
      const parsed = parsePhoneNumberFromString(phone);

      if (!parsed) return false;

      return parsed.isValid();
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'Invalid phone number format';
  }
}