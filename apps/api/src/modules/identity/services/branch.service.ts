import { Injectable, NotFoundException } from '@nestjs/common';
import { BranchRepository } from '@cc-erp/database';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';

@Injectable()
export class BranchService {
  private readonly branchRepository = new BranchRepository();

  async findAll(): Promise<any> {
    return this.branchRepository.findAll();
  }

  async findOne(id: string): Promise<any> {
    const branch = await this.branchRepository.findById(id);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<any> {
    return this.branchRepository.create(dto);
  }

  async update(id: string, dto: UpdateBranchDto): Promise<any> {
    await this.findOne(id);
    return this.branchRepository.update(id, dto);
  }

  async remove(id: string): Promise<any> {
    await this.findOne(id);
    return this.branchRepository.delete(id);
  }
}
