import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const directory = ".next/static";
if (!existsSync(directory)) {
  throw new Error("Build the application before checking the client bundle");
}

const values = ["SUPABASE_SERVICE_ROLE_KEY"];
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  values.push(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
if (existsSync(".env.local")) {
  const match = readFileSync(".env.local", "utf8").match(
    /^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m,
  );
  if (match?.[1]) values.push(match[1].trim());
}

let filesChecked = 0;
function inspect(directoryPath) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const path = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      inspect(path);
      continue;
    }
    const content = readFileSync(path);
    filesChecked++;
    for (const value of values) {
      if (content.includes(Buffer.from(value))) {
        throw new Error("Server credential marker found in client bundle");
      }
    }
  }
}

inspect(directory);
if (filesChecked === 0) throw new Error("No client bundle files found");
console.log(`Client bundle check passed (${filesChecked} files)`);
