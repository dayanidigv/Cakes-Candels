import { Injectable, NotFoundException } from '@nestjs/common';
import { POSRegisterRepository } from '@cc-erp/database';
import { CreatePOSRegisterDto } from '../dto/create-pos-register.dto';
import { UpdatePOSRegisterDto } from '../dto/update-pos-register.dto';

@Injectable()
export class POSRegisterService {
  private readonly posRegisterRepository = new POSRegisterRepository();

  async findAll(organizationId: string): Promise<any> {
    return this.posRegisterRepository.findAll(organizationId);
  }

  async findOne(id: string, organizationId: string): Promise<any> {
    const register = await this.posRegisterRepository.findById(id, organizationId);
    if (!register) {
      throw new NotFoundException('POS Register not found');
    }
    return register;
  }

  async create(dto: CreatePOSRegisterDto): Promise<any> {
    return this.posRegisterRepository.create(dto);
  }

  async update(id: string, organizationId: string, dto: UpdatePOSRegisterDto): Promise<any> {
    await this.findOne(id, organizationId);
    return this.posRegisterRepository.update(id, dto);
  }

  async remove(id: string, organizationId: string): Promise<any> {
    await this.findOne(id, organizationId);
    return this.posRegisterRepository.delete(id);
  }
}
