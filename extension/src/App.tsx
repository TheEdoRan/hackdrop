import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CrispIcon, SoftIcon } from "./components/ContrastIcon";
import { KebabIcon } from "./components/KebabIcon";
import { SourceColumn } from "./components/SourceColumn";
import { TextSizeLargeIcon, TextSizeSmallIcon } from "./components/TextSizeIcon";
import { XIcon } from "./components/XIcon";
import {
	CONTRAST_MODES,
	type ContrastMode,
	PREF_KEYS,
	readPref,
	TEXT_SIZES,
	type TextSize,
	writePref,
} from "./lib/prefs";
import { githubTrending } from "./sources/github-trending";
import { GithubTrendingColumn } from "./sources/github-trending/Column";
import { GitHubIcon } from "./sources/github-trending/Icon";
import { hackerNews } from "./sources/hacker-news";
import type { SourceId, SourceMeta } from "./sources/types";

const REPO_URL = "https://github.com/TheEdoRan/hackdrop";
const X_URL = "https://x.com/TheEdoRan";

const SOURCES: readonly SourceMeta[] = [githubTrending, hackerNews];

export function App() {
	const [activeId, setActiveId] = useState<SourceId>(githubTrending.id);

	const visibilityClass = (id: SourceId) => (activeId === id ? "flex" : "hidden md:flex");

	return (
		<main class="flex h-screen flex-col">
			<div class="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col px-5 pt-8 lg:px-10 lg:pt-10">
				<SourceToggle activeId={activeId} onChange={setActiveId} />

				<div class="grid min-h-0 flex-1 grid-cols-1 gap-x-10 md:grid-cols-2">
					<GithubTrendingColumn className={visibilityClass(githubTrending.id)} />
					<SourceColumn source={hackerNews} className={visibilityClass(hackerNews.id)} />
				</div>
			</div>

			<Footer />
		</main>
	);
}

function SourceToggle({ activeId, onChange }: { activeId: SourceId; onChange: (id: SourceId) => void }) {
	return (
		<div role="tablist" class="border-ink/80 dark:border-ink-dk/80 mb-3 flex border-b md:hidden">
			{SOURCES.map((source) => {
				const isActive = source.id === activeId;
				const accentClass = source.brand === "github" ? "text-brand-github dark:text-brand-github-dk" : "text-brand-hn";
				return (
					<button
						key={source.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						aria-label={source.name}
						title={source.name}
						onClick={() => onChange(source.id)}
						class={`-mb-px flex flex-1 items-center justify-center gap-2.5 border-b-2 px-4 py-3 transition-colors motion-reduce:transition-none ${
							isActive ? "border-ink dark:border-ink-dk" : "border-transparent opacity-50 hover:opacity-100"
						}`}
					>
						<source.Icon className={`size-4 shrink-0 ${accentClass}`} />
						<span class="text-ink dark:text-ink-dk hidden text-[0.813rem] font-medium tracking-[0.16em] uppercase sm:inline">
							{source.name}
						</span>
					</button>
				);
			})}
		</div>
	);
}

function Footer() {
	return (
		<footer class="mx-auto mt-4 mb-6 w-full max-w-[1500px] px-5 lg:px-10">
			<div class="border-rule dark:border-rule-dk flex items-center justify-end gap-4 border-t pt-4">
				<a
					href={X_URL}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Follow @TheEdoRan on X"
					title="Follow @TheEdoRan on X"
					class="text-ink-3 hover:text-ink dark:text-ink-3-dk dark:hover:text-ink-dk transition-colors motion-reduce:transition-none"
				>
					<XIcon className="size-[18px]" />
				</a>
				<a
					href={REPO_URL}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="View source on GitHub"
					title="View source on GitHub"
					class="text-ink-3 hover:text-ink dark:text-ink-3-dk dark:hover:text-ink-dk transition-colors motion-reduce:transition-none"
				>
					<GitHubIcon className="size-5" />
				</a>
				<SettingsMenu />
			</div>
		</footer>
	);
}

function SettingsMenu() {
	const [open, setOpen] = useState(false);
	const [contrast, setContrastState] = useState<ContrastMode>(() =>
		readPref(PREF_KEYS.contrast, "crisp", CONTRAST_MODES)
	);
	const [textSize, setTextSizeState] = useState<TextSize>(() => readPref(PREF_KEYS.textSize, "default", TEXT_SIZES));
	const ref = useRef<HTMLDivElement>(null);

	const setContrast = (mode: ContrastMode) => {
		setContrastState(mode);
		writePref(PREF_KEYS.contrast, mode);
		document.documentElement.classList.toggle("contrast-soft", mode === "soft");
	};

	const setTextSize = (size: TextSize) => {
		setTextSizeState(size);
		writePref(PREF_KEYS.textSize, size);
		document.documentElement.classList.toggle("text-smaller", size === "smaller");
	};

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={ref} class="relative inline-flex">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Open settings"
				title="Settings"
				onClick={() => setOpen((v) => !v)}
				class="text-ink-3 hover:text-ink dark:text-ink-3-dk dark:hover:text-ink-dk aria-expanded:text-ink dark:aria-expanded:text-ink-dk transition active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
			>
				<KebabIcon className="size-5" />
			</button>

			{open && (
				<div
					role="menu"
					class="border-rule dark:border-rule-dk bg-paper dark:bg-paper-dk menu-pop absolute right-0 bottom-full mb-2 w-56 rounded border p-1 shadow-lg"
				>
					<SettingsRow
						label="Text size"
						value={textSize === "smaller" ? "Smaller" : "Default"}
						onClick={() => setTextSize(textSize === "smaller" ? "default" : "smaller")}
					>
						{textSize === "smaller" ? (
							<TextSizeSmallIcon className="size-5" />
						) : (
							<TextSizeLargeIcon className="size-5" />
						)}
					</SettingsRow>
					<SettingsRow
						label="Contrast"
						value={contrast === "soft" ? "Soft" : "Crisp"}
						onClick={() => setContrast(contrast === "soft" ? "crisp" : "soft")}
					>
						{contrast === "soft" ? <SoftIcon className="size-[18px]" /> : <CrispIcon className="size-[18px]" />}
					</SettingsRow>
				</div>
			)}
		</div>
	);
}

function SettingsRow({
	label,
	value,
	onClick,
	children,
}: {
	label: string;
	value: string;
	onClick: () => void;
	children: ComponentChildren;
}) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			class="text-ink-2 hover:bg-hover hover:text-ink dark:text-ink-2-dk dark:hover:bg-hover-dk dark:hover:text-ink-dk flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-[13px] transition-colors motion-reduce:transition-none"
		>
			<span>{label}</span>
			<span class="text-ink-3 dark:text-ink-3-dk flex items-center gap-2">
				<span class="num text-[11px] uppercase">{value}</span>
				{children}
			</span>
		</button>
	);
}
