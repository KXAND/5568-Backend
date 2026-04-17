import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ArtifactJson = {
  abi?: unknown;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const contractsDir = path.join(projectRoot, "contracts");
const artifactsContractsDir = path.join(projectRoot, "artifacts", "contracts");
const abiDir = path.join(projectRoot, "ABI");

async function main() {
  await ensureDir(artifactsContractsDir, "artifacts/contracts");
  await ensureDir(contractsDir, "contracts");

  const artifactFiles = await collectJsonFiles(artifactsContractsDir);
  await rm(abiDir, { recursive: true, force: true });
  await mkdir(abiDir, { recursive: true });

  let updatedCount = 0;

  for (const artifactPath of artifactFiles) {
    const relativeArtifactPath = path.relative(artifactsContractsDir, artifactPath);
    const parsed = path.parse(relativeArtifactPath);

    if (path.extname(parsed.dir) !== ".sol") {
      continue;
    }

    const sourceRelativePath = parsed.dir;
    const sourcePath = path.join(contractsDir, sourceRelativePath);

    try {
      await stat(sourcePath);
    } catch {
      continue;
    }

    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as ArtifactJson;
    if (!Array.isArray(artifact.abi)) {
      continue;
    }

    const sourceDirRelative = path.dirname(sourceRelativePath);
    const targetDir = sourceDirRelative === "."
      ? abiDir
      : path.join(abiDir, sourceDirRelative);
    const targetPath = path.join(targetDir, parsed.base);

    await mkdir(targetDir, { recursive: true });
    await writeFile(targetPath, JSON.stringify(artifact.abi, null, 2) + "\n", "utf8");

    updatedCount += 1;
    console.log(`Updated ABI: ${path.relative(projectRoot, targetPath)}`);
  }

  console.log(`Done. Exported ${updatedCount} ABI file(s).`);
}

async function ensureDir(dirPath: string, label: string) {
  try {
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      throw new Error(`${label} is not a directory`);
    }
  } catch (error) {
    throw new Error(`Missing ${label}: ${dirPath}`, { cause: error });
  }
}

async function collectJsonFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return collectJsonFiles(fullPath);
      }
      return entry.isFile() && path.extname(entry.name) === ".json"
        ? [fullPath]
        : [];
    })
  );

  return files.flat();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
