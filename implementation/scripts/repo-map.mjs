import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const implementationRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(implementationRoot, "..");
const mapPath = join(repositoryRoot, "docs", "mapa_repositorio.md");
const startMarker = "<!-- repo-map:start -->";
const endMarker = "<!-- repo-map:end -->";

function childDirectories(parentPath, predicate = () => true) {
  if (!existsSync(parentPath)) return [];
  return readdirSync(parentPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name, join(parentPath, entry.name)))
    .map((entry) => join(parentPath, entry.name));
}

function hasPackageJson(_name, path) {
  return existsSync(join(path, "package.json"));
}

function hasSkill(_name, path) {
  return existsSync(join(path, "SKILL.md"));
}

function toRepositoryPath(path) {
  return `${relative(repositoryRoot, path).replaceAll("\\", "/")}/`;
}

function discoverStructuralPaths() {
  const paths = [
    join(repositoryRoot, "docs"),
    join(repositoryRoot, "evidence"),
    join(repositoryRoot, "implementation"),
    join(repositoryRoot, "skills"),
    ...childDirectories(join(repositoryRoot, "docs")),
    ...childDirectories(join(repositoryRoot, "skills"), hasSkill),
    ...childDirectories(join(implementationRoot, "apps"), hasPackageJson),
    ...childDirectories(join(implementationRoot, "packages"), hasPackageJson),
    ...childDirectories(join(implementationRoot, "apps", "web", "src", "features")),
    ...childDirectories(join(implementationRoot, "apps", "web", "src", "lib")),
    join(implementationRoot, "powersync"),
    join(implementationRoot, "scripts"),
    join(implementationRoot, "supabase"),
    ...childDirectories(
      join(implementationRoot, "supabase"),
      (name) => !name.startsWith(".") && name !== "node_modules",
    ),
  ];

  return [...new Set(paths.filter(existsSync).map(toRepositoryPath))].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

function renderInventory(paths) {
  return paths.map((path) => `- \`${path}\``).join("\n");
}

function replaceGeneratedBlock(document, inventory) {
  const start = document.indexOf(startMarker);
  const end = document.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start)
    throw new Error("El mapa no contiene un bloque generado válido.");
  const before = document.slice(0, start + startMarker.length);
  const after = document.slice(end);
  return `${before}\n${inventory}\n${after}`;
}

const mode = process.argv[2] ?? "--check";
if (mode !== "--check" && mode !== "--write")
  throw new Error("Uso: node scripts/repo-map.mjs [--check|--write]");

const currentDocument = readFileSync(mapPath, "utf8");
const expectedDocument = replaceGeneratedBlock(
  currentDocument,
  renderInventory(discoverStructuralPaths()),
);

if (mode === "--write") {
  writeFileSync(mapPath, expectedDocument, "utf8");
  console.log(`Mapa actualizado: ${relative(repositoryRoot, mapPath)}`);
} else if (currentDocument !== expectedDocument) {
  console.error("El mapa del repositorio está desactualizado. Ejecuta pnpm repo-map:update.");
  process.exitCode = 1;
} else {
  console.log("Mapa del repositorio vigente.");
}
