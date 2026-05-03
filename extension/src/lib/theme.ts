import { signal } from "@preact/signals";

const query = window.matchMedia("(prefers-color-scheme: dark)");

export const isDark = signal(query.matches);

query.addEventListener("change", (e) => {
	isDark.value = e.matches;
});
