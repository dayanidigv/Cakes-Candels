import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerAddressDto } from './dto/customer-address.dto';

@Injectable()
export class CustomersService {

  async create(createCustomerDto: CreateCustomerDto) {
    const existing = await prisma.customer.findUnique({
      where: { phone: createCustomerDto.phone }
    });

    if (existing) {
      throw new ConflictException('Customer with this phone number already exists.');
    }

    if (createCustomerDto.email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email: createCustomerDto.email }
      });
      if (existingEmail) {
        throw new ConflictException('Customer with this email already exists.');
      }
    }

    return prisma.customer.create({
      data: createCustomerDto
    });
  }

  async findAll(search?: string) {
    return prisma.customer.findMany({
      where: search ? {
        OR: [
          { phone: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
        isActive: true,
      } : { isActive: true },
      include: {
        addresses: true
      }
    });
  }

  async findOne(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.findOne(id);

    if (updateCustomerDto.phone && updateCustomerDto.phone !== customer.phone) {
      const existing = await prisma.customer.findUnique({
        where: { phone: updateCustomerDto.phone }
      });
      if (existing) {
        throw new ConflictException('Phone number is already in use by another customer.');
      }
    }

    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existing = await prisma.customer.findFirst({
        where: { email: updateCustomerDto.email }
      });
      if (existing) {
        throw new ConflictException('Email is already in use by another customer.');
      }
    }

    return prisma.customer.update({
      where: { id },
      data: updateCustomerDto
    });
  }

  async remove(id: string) {
    await this.findOne(id); // verify exists
    // Soft delete
    return prisma.customer.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    });
  }

  // Address Management

  async addAddress(customerId: string, createAddressDto: CreateCustomerAddressDto) {
    await this.findOne(customerId); // verify customer exists

    if (createAddressDto.isDefault) {
      // Set all other addresses for this customer to non-default
      await prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false }
      });
    } else {
      // If this is their first address, force it to be default
      const addressCount = await prisma.customerAddress.count({
        where: { customerId }
      });
      if (addressCount === 0) {
        createAddressDto.isDefault = true;
      }
    }

    return prisma.customerAddress.create({
      data: {
        ...createAddressDto,
        customerId
      }
    });
  }

  async updateAddress(customerId: string, addressId: string, updateData: Partial<CreateCustomerAddressDto>) {
    const address = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId }
    });
    
    if (!address) {
      throw new NotFoundException('Address not found for this customer');
    }

    if (updateData.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false }
      });
    }

    return prisma.customerAddress.update({
      where: { id: addressId },
      data: updateData
    });
  }

  async removeAddress(customerId: string, addressId: string) {
    const address = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId }
    });
    
    if (!address) {
      throw new NotFoundException('Address not found for this customer');
    }

    const removed = await prisma.customerAddress.delete({
      where: { id: addressId }
    });

    // If we removed the default address, promote the oldest remaining one
    if (address.isDefault) {
      const nextAddress = await prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: { id: 'asc' }
      });
      if (nextAddress) {
        await prisma.customerAddress.update({
          where: { id: nextAddress.id },
          data: { isDefault: true }
        });
      }
    }

    return removed;
  }
}
