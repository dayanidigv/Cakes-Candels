import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BranchService } from '../services/branch.service';
import { AuthGuard } from '../../../common/guards';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(AuthGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'Get all branches' })
  async findAll(): Promise<any> {
    return this.branchService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by UUID' })
  async findOne(@Param('id') id: string): Promise<any> {
    return this.branchService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new branch' })
  async create(@Body() dto: CreateBranchDto): Promise<any> {
    return this.branchService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update branch by UUID' })
  async update(@Param('id') id: string, @Body() dto: UpdateBranchDto): Promise<any> {
    return this.branchService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (deactivate) branch by UUID' })
  async remove(@Param('id') id: string): Promise<any> {
    return this.branchService.remove(id);
  }
}
