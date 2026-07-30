-- AlterTable
ALTER TABLE "Education" ADD COLUMN "level" TEXT;

-- AlterTable
ALTER TABLE "Education" ALTER COLUMN "degree" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Education" ALTER COLUMN "institution" DROP NOT NULL;
