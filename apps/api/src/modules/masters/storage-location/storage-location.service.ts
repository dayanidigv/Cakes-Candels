import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageLocationRepository } from '@cc-erp/database';
import { CreateStorageLocationDto } from './dto/create-storage-location.dto';
import { UpdateStorageLocationDto } from './dto/update-storage-location.dto';

@Injectable()
export class StorageLocationService {
  private readonly repository = new StorageLocationRepository();

  async findAll(): Promise<any> {
    const items = await this.repository.findAll();
    return { items, total: items.length };
  }

  async findById(id: string): Promise<any> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException('StorageLocation not found');
    return item;
  }

  async create(dto: CreateStorageLocationDto): Promise<any> {
    return this.repository.create(dto as any);
  }

  async update(id: string, dto: UpdateStorageLocationDto): Promise<any> {
    await this.findById(id);
    return this.repository.update(id, dto as any);
  }

  async remove(id: string, deletedBy: string): Promise<any> {
    await this.findById(id);
    return this.repository.delete(id, deletedBy);
  }
}
