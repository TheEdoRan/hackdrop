import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
	root: resolve(root, "src"),
	publicDir: resolve(root, "public"),
	build: {
		outDir: resolve(root, "dist"),
		emptyOutDir: true,
		target: "es2022",
		rollupOptions: {
			input: { newtab: resolve(root, "src/index.html") },
		},
	},
	plugins: [preact(), tailwindcss()],
});
