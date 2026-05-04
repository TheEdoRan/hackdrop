#!/usr/bin/env node
// usage: pnpm release <patch|minor|major|x.y.z> [--dry-run]
//
// bumps the version in extension/package.json, extension/public/manifest.json,
// and the root package.json in lockstep, commits the change, and tags it.
// does not push — prints `git push --follow-tags` and lets the operator pull the trigger.
//
// guards: refuses to run on a dirty tree, off `main`, on version drift between files,
// if the target tag already exists, or if CHANGELOG.md [Unreleased] is empty.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VERSIONED_FILES = ["extension/package.json", "extension/public/manifest.json", "package.json"];
const CHANGELOG = "CHANGELOG.md";
const VERSION_RE = /^(\s*"version"\s*:\s*")[^"]+(",?\s*)$/m;
const UNRELEASED_HEADING_RE = /^## \[Unreleased\][^\n]*$/m;
const FRESH_UNRELEASED = "## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bump = args.find((a) => !a.startsWith("--"));

if (!bump) {
	console.error("usage: pnpm release <patch|minor|major|x.y.z> [--dry-run]");
	process.exit(1);
}

function git(...gitArgs) {
	return execFileSync("git", gitArgs, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitTry(...gitArgs) {
	try {
		git(...gitArgs);
		return true;
	} catch {
		return false;
	}
}

function readVersion(file) {
	const text = readFileSync(path.join(root, file), "utf8");
	const m = text.match(VERSION_RE);
	if (!m) throw new Error(`no top-level "version" in ${file}`);
	return m[0].match(/"([^"]+)"\s*,?\s*$/)[1];
}

function bumpSemver(current, kind) {
	const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
	if (!m) throw new Error(`current version ${current} is not x.y.z`);
	let [major, minor, patch] = [+m[1], +m[2], +m[3]];
	if (kind === "patch") patch++;
	else if (kind === "minor") {
		minor++;
		patch = 0;
	} else if (kind === "major") {
		major++;
		minor = 0;
		patch = 0;
	} else throw new Error(`unknown bump: ${kind}`);
	return `${major}.${minor}.${patch}`;
}

function resolveNext(current, arg) {
	if (/^(patch|minor|major)$/.test(arg)) return bumpSemver(current, arg);
	if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;
	throw new Error(`bump must be patch|minor|major or an exact x.y.z (got "${arg}")`);
}

function locateUnreleased(text) {
	const start = text.match(UNRELEASED_HEADING_RE);
	if (!start) throw new Error(`${CHANGELOG} is missing the '## [Unreleased]' heading`);
	const headingEnd = start.index + start[0].length;
	const after = text.slice(headingEnd);
	const next = after.match(/^## \[/m);
	const sectionEnd = next ? headingEnd + next.index : text.length;
	return { headingStart: start.index, headingEnd, sectionEnd, body: text.slice(headingEnd, sectionEnd) };
}

function unreleasedHasContent(body) {
	return body.split("\n").some((line) => {
		const t = line.trim();
		return t !== "" && !t.startsWith("###");
	});
}

function promoteChangelog(text, version, date) {
	const { headingStart, sectionEnd, body } = locateUnreleased(text);
	return text.slice(0, headingStart) + FRESH_UNRELEASED + `## [${version}] - ${date}` + body + text.slice(sectionEnd);
}

const status = git("status", "--porcelain");
if (status) {
	console.error("working tree is dirty — commit or stash first.\n" + status);
	process.exit(1);
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") {
	console.error(`expected to be on main, currently on ${branch}.`);
	process.exit(1);
}

const versions = VERSIONED_FILES.map((f) => [f, readVersion(f)]);
if (versions.some(([, v]) => v !== versions[0][1])) {
	console.error("version drift detected — files are out of sync:");
	for (const [f, v] of versions) console.error(`  ${f}: ${v}`);
	process.exit(1);
}

const current = versions[0][1];
const next = resolveNext(current, bump);
const tag = `v${next}`;
const today = new Date().toISOString().slice(0, 10);

if (gitTry("rev-parse", "--verify", "--quiet", `refs/tags/${tag}`)) {
	console.error(`tag ${tag} already exists.`);
	process.exit(1);
}

const changelogPath = path.join(root, CHANGELOG);
const changelogText = readFileSync(changelogPath, "utf8");
if (!unreleasedHasContent(locateUnreleased(changelogText).body)) {
	console.error(`${CHANGELOG} [Unreleased] is empty — add at least one entry before releasing.`);
	process.exit(1);
}

console.log(`hackdrop release: ${current} → ${next}`);
for (const f of VERSIONED_FILES) {
	const p = path.join(root, f);
	const text = readFileSync(p, "utf8");
	const updated = text.replace(VERSION_RE, `$1${next}$2`);
	if (text === updated) throw new Error(`no version replacement made in ${f}`);
	if (dryRun) console.log(`  [dry-run] would update ${f}`);
	else {
		writeFileSync(p, updated);
		console.log(`  updated ${f}`);
	}
}

const updatedChangelog = promoteChangelog(changelogText, next, today);
if (dryRun) console.log(`  [dry-run] would promote ${CHANGELOG} [Unreleased] → [${next}] - ${today}`);
else {
	writeFileSync(changelogPath, updatedChangelog);
	console.log(`  updated ${CHANGELOG}`);
}

const toCommit = [...VERSIONED_FILES, CHANGELOG];

if (dryRun) {
	console.log(`[dry-run] would commit and tag ${tag}.`);
	process.exit(0);
}

git("add", ...toCommit);
git("commit", "-m", `chore(release): ${tag}`);
git("tag", "-a", tag, "-m", tag);

console.log(`\ndone. next: git push --follow-tags`);
