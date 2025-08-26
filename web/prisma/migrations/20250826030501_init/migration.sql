-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT
);
