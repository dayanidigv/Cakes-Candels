-- DropIndex
DROP INDEX "Brand_name_key";

-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "Category_slug_key";

-- DropIndex
DROP INDEX "NumberSeries_documentType_branchId_key";

-- DropIndex
DROP INDEX "ProductAttribute_name_key";

-- DropIndex
DROP INDEX "RecipeMaster_name_key";

-- DropIndex
DROP INDEX "Supplier_code_key";

-- DropIndex
DROP INDEX "Supplier_name_key";

-- DropIndex
DROP INDEX "TaxRule_name_key";

-- DropIndex
DROP INDEX "UnitOfMeasure_name_key";

-- DropIndex
DROP INDEX "UnitOfMeasure_symbol_key";

-- DropIndex
DROP INDEX "product_sku_key";

-- DropIndex
DROP INDEX "product_variant_barcode_key";

-- DropIndex
DROP INDEX "product_variant_sku_key";

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "NumberSeries" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ProductAttribute" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "RecipeMaster" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "TaxRule" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "UnitOfMeasure" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "organizationId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "product_variant" ADD COLUMN     "organizationId" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_organizationId_name_key" ON "Brand"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_name_key" ON "Category"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_slug_key" ON "Category"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSeries_organizationId_documentType_branchId_key" ON "NumberSeries"("organizationId", "documentType", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_organizationId_name_key" ON "ProductAttribute"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeMaster_organizationId_name_key" ON "RecipeMaster"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_code_key" ON "Supplier"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_name_key" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_organizationId_name_key" ON "TaxRule"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_organizationId_name_key" ON "UnitOfMeasure"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_organizationId_symbol_key" ON "UnitOfMeasure"("organizationId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "product_organizationId_sku_key" ON "product"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_organizationId_sku_key" ON "product_variant"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_organizationId_barcode_key" ON "product_variant"("organizationId", "barcode");

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMaster" ADD CONSTRAINT "RecipeMaster_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeries" ADD CONSTRAINT "NumberSeries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

