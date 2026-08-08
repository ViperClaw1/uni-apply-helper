-- AlterTable
ALTER TABLE "Student" ADD COLUMN "accountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_accountId_key" ON "Student"("accountId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
