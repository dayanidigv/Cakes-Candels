import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRepository } from '@cc-erp/database';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  private readonly organizationRepository = new OrganizationRepository();

  async findAll(): Promise<any> {
    return this.organizationRepository.findAll();
  }

  async findOne(id: string): Promise<any> {
    const org = await this.organizationRepository.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async create(dto: CreateOrganizationDto): Promise<any> {
    return this.organizationRepository.create(dto);
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<any> {
    await this.findOne(id);
    return this.organizationRepository.update(id, dto);
  }

  async remove(id: string): Promise<any> {
    await this.findOne(id);
    return this.organizationRepository.delete(id);
  }
}
