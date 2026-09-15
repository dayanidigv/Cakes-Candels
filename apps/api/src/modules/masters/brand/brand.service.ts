import { Injectable, NotFoundException } from '@nestjs/common';
import { BrandRepository } from '@cc-erp/database';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  private readonly repository = new BrandRepository();

  async findAll(): Promise<any> {
    const items = await this.repository.findAll();
    return { items, total: items.length };
  }

  async findById(id: string): Promise<any> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException('Brand not found');
    return item;
  }

  async create(dto: CreateBrandDto): Promise<any> {
    return this.repository.create(dto as any);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<any> {
    await this.findById(id);
    return this.repository.update(id, dto as any);
  }

  async remove(id: string, deletedBy: string): Promise<any> {
    await this.findById(id);
    return this.repository.delete(id, deletedBy);
  }
}
