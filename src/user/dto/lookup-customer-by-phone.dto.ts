import { Matches } from 'class-validator';

export class LookupCustomerByPhoneDto {
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone must use E.164 format. Example: +23566123456',
  })
  phone!: string;
}
