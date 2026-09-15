import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  async findAll(orgId: string): Promise<any> {
    const items = await prisma.category.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: { children: { where: { organizationId: orgId, deletedAt: null } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return { items, total: items.length };
  }

  /**
   * Returns the full category tree: top-level categories with nested children.
   * Used by Storefront and POS catalogue navigation.
   */
  async findTree(orgId: string): Promise<any> {
    const roots = await prisma.category.findMany({
      where: { organizationId: orgId, parentId: null, deletedAt: null, isActive: true },
      include: {
        children: {
          where: { organizationId: orgId, deletedAt: null, isActive: true },
          include: {
            children: { where: { organizationId: orgId, deletedAt: null, isActive: true } },
          },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return roots;
  }

  async findById(orgId: string, id: string): Promise<any> {
    const item = await prisma.category.findFirst({
      where: { organizationId: orgId, id, deletedAt: null },
      include: {
        parent: true,
        children: { where: { organizationId: orgId, deletedAt: null } },
      },
    });
    if (!item) throw new NotFoundException('Category not found');
    return item;
  }

  async create(orgId: string, dto: CreateCategoryDto): Promise<any> {
    // Validate parent if provided
    if (dto.parentId) {
      const parent = await prisma.category.findFirst({
        where: { organizationId: orgId, id: dto.parentId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
      // Prevent deeper than 2 levels (root → sub)
      if (parent.parentId) {
        throw new BadRequestException('Category hierarchy cannot exceed 2 levels deep');
      }
    }

    return prisma.category.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        description: dto.description,
        slug: dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, '-'),
        icon: dto.icon,
        imageUrl: dto.imageUrl,
        color: dto.color,
        displayOrder: dto.displayOrder ?? 0,
        showInPos: dto.showInPos ?? true,
        showInStore: dto.showInStore ?? true,
        isActive: dto.isActive ?? true,
      },
      include: { parent: true, children: true },
    });
  }

  async update(orgId: string, id: string, dto: UpdateCategoryDto): Promise<any> {
    await this.findById(orgId, id);
    return prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        slug: dto.slug,
        icon: dto.icon,
        imageUrl: dto.imageUrl,
        color: dto.color,
        displayOrder: dto.displayOrder,
        showInPos: dto.showInPos,
        showInStore: dto.showInStore,
        isActive: dto.isActive,
      },
      include: { parent: true, children: true },
    });
  }

  async remove(orgId: string, id: string, deletedBy: string): Promise<any> {
    await this.findById(orgId, id);
    // Soft-delete: never hard-delete to preserve product references
    return prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, isActive: false },
    });
  }
}
