import { readdir, mkdir, readFile, writeFile } from "fs/promises";
import { join, dirname, relative, extname } from "path";
import { Transpiler } from "bun";

const sourceDir = "./";
const buildDir = "./build";
const exclude = ["node_modules", ".git", "build", ".history"];

async function ensureDirectoryExistence(filePath) {
    const dir = dirname(filePath);
    try {
        await mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
    }
}

async function convertTsToJs(filePath) {
    const relativePath = relative(sourceDir, filePath);
    const outputPath = join(buildDir, relativePath).replace(/\.ts$/, ".js");
    await ensureDirectoryExistence(outputPath);

    const transpiler = new Transpiler({ loader: "tsx" });
    const typeScript = await readFile(filePath, "utf8");
    const javaScript = await transpiler.transform(typeScript);

    await writeFile(outputPath, javaScript);
    console.log(`Converted ${filePath} to ${outputPath}`);
}

async function traverseDirectory(directory) {
    const files = await readdir(directory, { withFileTypes: true });

    for (const file of files) {
        if (exclude.includes(file.name)) continue;
        const fullPath = join(directory, file.name);
        if (file.isDirectory()) {
            await traverseDirectory(fullPath);
        } else if (file.isFile() && extname(file.name) === ".ts") {
            await convertTsToJs(fullPath);
        }
    }
}

traverseDirectory(sourceDir).catch(console.error);
