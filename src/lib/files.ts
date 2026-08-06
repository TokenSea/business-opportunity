import { unlink } from "node:fs/promises";
import path from "node:path";

export async function removeStoredFiles(filePaths: string[]) {
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"));
  const uniquePaths = [...new Set(filePaths.map((filePath) => path.resolve(filePath)))];

  await Promise.allSettled(uniquePaths.map(async (filePath) => {
    if (filePath !== uploadRoot && !filePath.startsWith(`${uploadRoot}${path.sep}`)) return;
    try {
      await unlink(filePath);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }));
}
