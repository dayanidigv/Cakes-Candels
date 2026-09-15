import { PartialType } from '@nestjs/swagger';
import { CreatePaymentMethodDto } from './create-payment-methods.dto';

export class UpdatePaymentMethodDto extends PartialType(CreatePaymentMethodDto) {}
