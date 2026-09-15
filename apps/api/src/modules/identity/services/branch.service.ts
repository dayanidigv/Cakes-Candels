import { Injectable, NotFoundException } from '@nestjs/common';
import { BranchRepository } from '@cc-erp/database';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';

@Injectable()
export class BranchService {
  private readonly branchRepository = new BranchRepository();

  async findAll(organizationId: string): Promise<any> {
    return this.branchRepository.findAll(organizationId);
  }

  async findOne(id: string, organizationId: string): Promise<any> {
    const branch = await this.branchRepository.findById(id, organizationId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<any> {
    return this.branchRepository.create(dto);
  }

  async update(id: string, organizationId: string, dto: UpdateBranchDto): Promise<any> {
    await this.findOne(id, organizationId);
    return this.branchRepository.update(id, dto);
  }

  async remove(id: string, organizationId: string): Promise<any> {
    await this.findOne(id, organizationId);
    return this.branchRepository.delete(id);
  }
}
