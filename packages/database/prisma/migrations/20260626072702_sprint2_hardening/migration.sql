/*
  Warnings:

  - You are about to drop the column `taxId` on the `Supplier` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Supplier` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "color" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "StorageLocation" ADD COLUMN     "capacity" TEXT,
ADD COLUMN     "locationCode" TEXT,
ADD COLUMN     "parentId" UUID,
ADD COLUMN     "temperatureType" TEXT;

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "taxId",
ADD COLUMN     "bankDetails" JSONB,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "creditLimit" DECIMAL(12,2),
ADD COLUMN     "gst" TEXT,
ADD COLUMN     "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "preferredSupplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TaxRule" ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "hsn" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UnitOfMeasure" ADD COLUMN     "allowDecimal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "baseUnitId" UUID,
ADD COLUMN     "conversionFactor" DECIMAL(10,4);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
