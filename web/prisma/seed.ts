import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Add one sample Run row in the database
  await prisma.run.create({
    data: {
      inputJson: { cableLengths: [1.01, 0.98, 1.05, 0.99], guess: [0,0,0,0,0,0] },
      resultJson: { pose: [0.1, -0.02, 0.05, 0, 0.01, 0], error: 0.0042, iterations: 12 },
      status: "SUCCESS",
      notes: "Seeded demo run"
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });
