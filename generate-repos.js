const fs = require('fs');
const path = require('path');

const repos = [
  { name: 'ProductAttribute', file: 'product-attribute.repository.ts' },
  { name: 'ProductAttributeValue', file: 'product-attribute-value.repository.ts' },
  { name: 'RecipeMaster', file: 'recipe-master.repository.ts' },
  { name: 'RecipeVersion', file: 'recipe-version.repository.ts' },
  { name: 'RecipeIngredient', file: 'recipe-ingredient.repository.ts' },
  { name: 'SupplierItem', file: 'supplier-item.repository.ts' },
  { name: 'TaxComponent', file: 'tax-component.repository.ts' },
  { name: 'NumberSeries', file: 'number-series.repository.ts' },
  { name: 'ApprovalWorkflow', file: 'approval-workflow.repository.ts' },
  { name: 'ApprovalStep', file: 'approval-step.repository.ts' },
];

const template = (model) => `import { prisma, ${model}, Prisma } from '../client/index';

export class ${model}Repository {
  async findAll(): Promise<${model}[]> {
    return prisma.${model.charAt(0).toLowerCase() + model.slice(1)}.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<${model} | null> {
    return prisma.${model.charAt(0).toLowerCase() + model.slice(1)}.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.${model}CreateInput | Prisma.${model}UncheckedCreateInput): Promise<${model}> {
    return prisma.${model.charAt(0).toLowerCase() + model.slice(1)}.create({ data });
  }

  async update(id: string, data: Prisma.${model}UpdateInput | Prisma.${model}UncheckedUpdateInput): Promise<${model}> {
    return prisma.${model.charAt(0).toLowerCase() + model.slice(1)}.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<${model}> {
    return prisma.${model.charAt(0).toLowerCase() + model.slice(1)}.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
`;

const dir = path.join(__dirname, 'packages/database/src/repositories');

repos.forEach(repo => {
  const filePath = path.join(dir, repo.file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, template(repo.name));
    console.log(`Created ${repo.file}`);
  }
});
