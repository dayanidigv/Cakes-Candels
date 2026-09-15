import { Injectable } from '@nestjs/common';
import { PermissionRepository } from '@cc-erp/database';

@Injectable()
export class PermissionService {
  private readonly permissionRepository = new PermissionRepository();

  async findAll(): Promise<any> {
    return this.permissionRepository.findAll();
  }
}
