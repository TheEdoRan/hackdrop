// Apply saved prefs to <html> before first paint to avoid a flash.
// Mirrors validation in src/lib/prefs.ts. localStorage so reads stay sync.
// Loaded as an external file (not inline) because the packaged extension's
// CSP is `script-src 'self'`, which forbids inline scripts.
(function () {
	try {
		var ls = window.localStorage;
		var c = JSON.parse(ls.getItem("hackdrop:prefs:contrast") || "null");
		var s = JSON.parse(ls.getItem("hackdrop:prefs:text-size") || "null");
		var html = document.documentElement;
		if (c === "soft") html.classList.add("contrast-soft");
		if (s === "smaller") html.classList.add("text-smaller");
	} catch (_) {
		/* ignore */
	}
})();
