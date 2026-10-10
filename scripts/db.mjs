#!/usr/bin/env node
/**
 * PostgreSQL local sans Docker (binaires officiels fournis par le paquet npm `embedded-postgres`).
 *
 *   node scripts/db.mjs start [dev|test]   initialise si besoin, démarre, crée la base
 *   node scripts/db.mjs stop  [dev|test]
 *   node scripts/db.mjs status [dev|test]
 *
 * Données dans .pg/<instance>/ (ignoré par git). Écoute uniquement sur 127.0.0.1.
 * Production : utilisez Neon (ou tout PostgreSQL managé), pas ce script.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const INSTANCES = {
  dev: { port: 54320, database: "globespeak" },
  test: { port: 54321, database: "globespeak_test" },
};
const USER = "postgres";
const PASSWORD = "postgres"; // instance locale, accessible uniquement depuis 127.0.0.1

function binDir() {
  const pkg = { win32: "windows-x64", darwin: process.arch === "arm64" ? "darwin-arm64" : "darwin-x64", linux: process.arch === "arm64" ? "linux-arm64" : "linux-x64" }[process.platform];
  if (!pkg) throw new Error(`Plateforme non prise en charge : ${process.platform}`);
  // Le paquet n'exporte pas de point d'entrée : on cherche le dossier dans les node_modules accessibles.
  for (const base of require.resolve.paths("@embedded-postgres") ?? []) {
    const dir = path.join(base, "@embedded-postgres", pkg, "native", "bin");
    if (existsSync(dir)) return dir;
  }
  throw new Error(`Binaires PostgreSQL introuvables (@embedded-postgres/${pkg}) : lancez npm install`);
}

const exe = (name) => path.join(binDir(), process.platform === "win32" ? `${name}.exe` : name);

function run(name, args, opts = {}) {
  return execFileSync(exe(name), args, { stdio: "pipe", encoding: "utf8", ...opts });
}

async function createDatabase(port, database) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ host: "127.0.0.1", port, user: USER, password: PASSWORD, database: "postgres" });
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  await client.end();
}

function isRunning(dataDir) {
  try {
    run("pg_ctl", ["status", "-D", dataDir]);
    return true;
  } catch {
    return false;
  }
}

async function start(name) {
  const { port, database } = INSTANCES[name];
  const dataDir = path.resolve(".pg", name);
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    mkdirSync(dataDir, { recursive: true });
    const pwfile = path.resolve(".pg", `${name}.pw`);
    writeFileSync(pwfile, PASSWORD);
    run("initdb", ["-D", dataDir, "-U", USER, "--pwfile", pwfile, "--auth=scram-sha-256", "-E", "UTF8", "--locale=C"]);
    rmSync(pwfile);
    console.log(`✓ Instance « ${name} » initialisée dans ${dataDir}`);
  }
  if (!isRunning(dataDir)) {
    // stdio "ignore" : le serveur, détaché, ne doit pas hériter de nos flux (sinon l'appel ne rend jamais la main).
    execFileSync(exe("pg_ctl"), [
      "start",
      "-D",
      dataDir,
      "-w",
      "-l",
      path.join(dataDir, "server.log"),
      "-o",
      `-p ${port} -c listen_addresses=127.0.0.1 -c max_connections=100`,
    ], { stdio: "ignore", windowsHide: true });
  }
  await createDatabase(port, database);
  console.log(`✓ PostgreSQL « ${name} » prêt`);
  console.log(`  DATABASE_URL="postgres://${USER}:${PASSWORD}@127.0.0.1:${port}/${database}"`);
}

function stop(name) {
  const dataDir = path.resolve(".pg", name);
  if (isRunning(dataDir)) run("pg_ctl", ["stop", "-D", dataDir, "-m", "fast", "-w"]);
  console.log(`✓ PostgreSQL « ${name} » arrêté`);
}

const [command = "start", name = "dev"] = process.argv.slice(2);
if (!INSTANCES[name]) {
  console.error(`Instance inconnue : ${name} (dev | test)`);
  process.exit(1);
}
if (command === "start") await start(name);
else if (command === "stop") stop(name);
else if (command === "status") console.log(isRunning(path.resolve(".pg", name)) ? "en marche" : "arrêtée");
else {
  console.error("Usage : node scripts/db.mjs start|stop|status [dev|test]");
  process.exit(1);
}
