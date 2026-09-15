import { Injectable, NotFoundException } from '@nestjs/common';
import { SupplierRepository } from '@cc-erp/database';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  private readonly repository = new SupplierRepository();

  async findAll(): Promise<any> {
    const items = await this.repository.findAll();
    return { items, total: items.length };
  }

  async findById(id: string): Promise<any> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException('Supplier not found');
    return item;
  }

  async create(dto: CreateSupplierDto): Promise<any> {
    return this.repository.create(dto as any);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<any> {
    await this.findById(id);
    return this.repository.update(id, dto as any);
  }

  async remove(id: string, deletedBy: string): Promise<any> {
    await this.findById(id);
    return this.repository.delete(id, deletedBy);
  }
}
