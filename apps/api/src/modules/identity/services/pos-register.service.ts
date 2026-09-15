import { Injectable, NotFoundException } from '@nestjs/common';
import { POSRegisterRepository } from '@cc-erp/database';
import { CreatePOSRegisterDto } from '../dto/create-pos-register.dto';
import { UpdatePOSRegisterDto } from '../dto/update-pos-register.dto';

@Injectable()
export class POSRegisterService {
  private readonly posRegisterRepository = new POSRegisterRepository();

  async findAll(): Promise<any> {
    return this.posRegisterRepository.findAll();
  }

  async findOne(id: string): Promise<any> {
    const register = await this.posRegisterRepository.findById(id);
    if (!register) {
      throw new NotFoundException('POS Register not found');
    }
    return register;
  }

  async create(dto: CreatePOSRegisterDto): Promise<any> {
    return this.posRegisterRepository.create(dto);
  }

  async update(id: string, dto: UpdatePOSRegisterDto): Promise<any> {
    await this.findOne(id);
    return this.posRegisterRepository.update(id, dto);
  }

  async remove(id: string): Promise<any> {
    await this.findOne(id);
    return this.posRegisterRepository.delete(id);
  }
}
