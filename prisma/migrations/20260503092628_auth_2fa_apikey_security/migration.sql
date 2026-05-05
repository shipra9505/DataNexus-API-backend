/*
  Warnings:

  - You are about to drop the column `key` on the `ApiKey` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fingerprint]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fingerprint` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ApiKey_key_idx";

-- DropIndex
DROP INDEX "ApiKey_key_key";

-- AlterTable
ALTER TABLE "ApiKey" DROP COLUMN "key",
ADD COLUMN     "fingerprint" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "twoFactorTempSecret" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_fingerprint_key" ON "ApiKey"("fingerprint");

-- CreateIndex
CREATE INDEX "ApiKey_fingerprint_idx" ON "ApiKey"("fingerprint");
