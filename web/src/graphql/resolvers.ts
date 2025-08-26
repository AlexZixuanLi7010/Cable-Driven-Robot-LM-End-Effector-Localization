// web/src/graphql/resolvers.ts
import { prisma } from "../lib/db";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Use your installed MATLAB (update if needed)
const MATLAB =
  process.env.MATLAB_PATH || "/Applications/MATLAB_R2024a.app/bin/matlab";

// solver folder is PARALLEL to /web  ->  ../solver
const SOLVER_DIR =
  process.env.SOLVER_DIR || path.resolve(process.cwd(), "../solver");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export const resolvers = {
  Query: {
    runs: () => prisma.run.findMany({ orderBy: { createdAt: "desc" } }),
    run: (_: any, { id }: { id: string }) =>
      prisma.run.findUnique({ where: { id } }),
  },

  Mutation: {
    optimize: async (_: any, { input }: any) => {
      // 1) Write input.json into solver directory
      await ensureDir(SOLVER_DIR);
      const inPath = path.join(SOLVER_DIR, "input.json");
      const outPath = path.join(SOLVER_DIR, "output.json");

      await fs.writeFile(
        inPath,
        JSON.stringify(
          {
            anchors: input.anchors,
            attachments: input.attachments,
            cableLengths: input.cableLengths,
            initialGuess: input.initialGuess,
          },
          null,
          2
        ),
        "utf8"
      );

      // 2) Call MATLAB in the solver directory (headless)
      const batch = `optimize_from_json('input.json','output.json')`;
      try {
        const { stdout, stderr } = await execFileAsync(
          MATLAB,
          ["-batch", batch],
          { cwd: SOLVER_DIR, timeout: 120_000 }
        );
        if (stdout) console.log("[MATLAB stdout]\n" + stdout);
        if (stderr) console.warn("[MATLAB stderr]\n" + stderr);
      } catch (e: any) {
        console.error("MATLAB error:", e.stderr || e.message || e);
        throw new Error("MATLAB failed: " + (e.stderr || e.message));
      }

      // 3) Read output.json
      const buf = await fs.readFile(outPath, "utf8");
      const result = JSON.parse(buf); // { pose, error, iterations, residuals }

      // 4) Persist and return
      await prisma.run.create({
        data: {
          inputJson: input,
          resultJson: result,
          status: "SUCCESS",
          notes: "MATLAB solve",
        },
      });

      return result;
    },
  },
};
