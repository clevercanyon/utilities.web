/**
 * Vite config file.
 *
 * Vite is not aware of this config file's location.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 *
 * @see https://vitejs.dev/config/
 */
/* eslint-env es2021, node */

import mc from '@clevercanyon/js-object-mc';
import pluginBasicSSL from '@vitejs/plugin-basic-ssl';
import chalk from 'chalk';
import desm from 'desm';
import glob from 'glob';
import _ from 'lodash';
import minimatch from 'minimatch';
import fsp from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';
import { loadEnv } from 'vite';
import { ViteEjsPlugin as pluginEJS } from 'vite-plugin-ejs';
import { ViteMinifyPlugin as pluginMinifyHTML } from 'vite-plugin-minify';
import aliases from './includes/aliases.js';

/**
 * Validates project config.
 *
 * @param config Project config.
 *
 * @returns True on successful validation.
 */
const validateProjConfig = (config) => {
	if (typeof config?.appType !== 'undefined') {
		throw new Error('Modifying `appType` is not permitted at this time. Instead, use `config.c10n.&.build.appType` in `package.json`.');
	}
	if (typeof config.build?.formats !== 'undefined') {
		throw new Error('Modifying `build.formats` is not permitted at this time.');
	}
};

/**
 * Defines Vite configuration.
 *
 * @param   {object}          vite       Data passed in by Vite.
 * @param   {object}          projConfig Project configuration overrides.
 *
 * @returns {Promise<object>}            Vite configuration object properties.
 */
export default async ({ mode } /* { command, mode, ssrBuild } */, projConfig = {}) => {
	validateProjConfig(projConfig);
	/**
	 * Initializes vars.
	 */
	const __dirname = desm(import.meta.url);
	const projDir = path.resolve(__dirname, '../../..');
	const srcDir = path.resolve(__dirname, '../../../src');
	const envsDir = path.resolve(__dirname, '../../../src/.envs');

	const pkgFile = path.resolve(projDir, './package.json');
	const pkg = JSON.parse(await fsp.readFile(pkgFile));
	const pkgPrettierCfg = { ...(await prettier.resolveConfig(pkgFile)), parser: 'json' };

	const publicEnvPrefix = 'APP_PUBLIC_'; // Used below also.
	const env = loadEnv(mode, envsDir, publicEnvPrefix);

	const isProd = /^prod(uction)?$/iu.test(mode);
	const isDev = !isProd; // Always opposite.
	const nodeEnv = isProd ? 'production' : 'development';

	/**
	 * `appType` = `mpa` (multipage), `cma` (custom). `targetEnv` = `any`,
	 * `cfp`, `cfw`, `node`, `web`, `webw`, `opl`.
	 *
	 * 1. `mpa` = Multipage app. Must use `index.html` entry points.
	 * 2. `cma` = Custom-made app. Must use `.{tsx,ts,jsx,mjs,js}` entry points.
	 */
	const appType = pkg.config?.c10n?.['&'].build?.appType || 'cma';
	const targetEnv = pkg.config?.c10n?.['&'].build?.targetEnv || 'any';
	const isMpa = 'mpa' === appType,
		isCma = 'cma' === appType;

	let cmaName = (pkg.name || '').toLowerCase();
	cmaName = cmaName.replace(/\bclevercanyon\b/gu, 'c10n');
	cmaName = cmaName.replace(/@/gu, '').replace(/\./gu, '-').replace(/\/+/gu, '.');
	cmaName = cmaName.replace(/[^a-z.0-9]([^.])/gu, (m0, m1) => m1.toUpperCase());
	cmaName = cmaName.replace(/^\.|\.$/u, '');

	const mpaAbsIndexes = glob.sync(path.join(srcDir, '/**/index.html'), { nodir: true });
	const mpaRelIndexes = mpaAbsIndexes.map((absPath) => './' + path.relative(srcDir, absPath));

	const cmaAbsEntries = glob.sync(path.join(srcDir, '/*.{tsx,ts,jsx,mjs,js}'), { nodir: true });
	const cmaRelEntries = cmaAbsEntries.map((absPath) => './' + path.relative(srcDir, absPath));

	const mpaEntryIndex = mpaRelIndexes.find((relPath) => minimatch(relPath, './index.html'));
	const cmaEntryIndex = cmaRelEntries.find((relPath) => minimatch(relPath, './index.{tsx,ts,jsx,mjs,js}'));

	const isWeb = ['web', 'webw'].includes(targetEnv);
	const isSSR = ['cfp', 'cfw', 'node'].includes(targetEnv);
	const isSSRWorker = isSSR && ['cfw'].includes(targetEnv);

	if ((!isMpa && !isCma) || !['mpa', 'cma'].includes(appType)) {
		throw new Error('Must have a valid `config.c10n.&.build.appType` in `package.json`.');
	}
	if (!['any', 'cfp', 'cfw', 'node', 'web', 'webw', 'opl'].includes(targetEnv)) {
		throw new Error('Must have a valid `config.c10n.&.build.targetEnv` in `package.json`.');
	}
	if (isMpa && !mpaEntryIndex) {
		throw new Error('Multipage apps must have an `./index.{tsx,ts,jsx,mjs,js}` entry point.');
	}
	if (isCma && !cmaEntryIndex) {
		throw new Error('Custom apps must have an `./index.{tsx,ts,jsx,mjs,js}` entry point.');
	}
	/**
	 * Updates `package.json` accordingly.
	 */
	pkg.exports = pkg.exports || {};
	pkg.exports['.'] = pkg.exports['.'] || {};

	if (isCma && (isSSR || cmaRelEntries.length > 1)) {
		mc.patch(pkg.exports, {
			'.': {
				import: './dist/index.js',
				require: './dist/index.cjs',
			},
		});
		pkg.module = './dist/index.js';
		pkg.main = './dist/index.cjs';
		pkg.types = './dist/types/index.d.ts';
		pkg.browser = isWeb ? pkg.module : '';
		pkg.unpkg = pkg.module;
	} else if (isCma) {
		mc.patch(pkg.exports, {
			'.': {
				import: './dist/index.js',
				require: './dist/index.umd.cjs',
			},
		});
		pkg.module = './dist/index.js';
		pkg.main = './dist/index.umd.cjs';
		pkg.types = './dist/types/index.d.ts';
		pkg.browser = isWeb ? pkg.main : '';
		pkg.unpkg = pkg.main;
	} else {
		// It's not a CMA. It's an MPA.
		pkg.exports = {}; // Clear these out entirely.
		pkg.module = pkg.main = pkg.unpkg = pkg.browser = pkg.types = '';
	}
	await fsp.writeFile(pkgFile, prettier.format(JSON.stringify(pkg, null, 4), pkgPrettierCfg));

	console.log(
		chalk.blue('Updated `package.json` properties: ') + //
			chalk.green(JSON.stringify(_.pick(pkg, ['exports', 'module', 'main', 'unpkg', 'browser', 'types']), null, 4)),
	);

	/**
	 * Configures rollup.
	 *
	 * @see https://o5p.me/5Vupql
	 */
	const rollupConfig = {
		input: isCma // Absolute paths.
			? cmaAbsEntries
			: mpaAbsIndexes,

		// Peer dependencies are flagged as external as they'll be installed by a peer.
		...(Object.keys(pkg.peerDependencies || {}).length ? { external: Object.keys(pkg.peerDependencies) } : {}),

		output: {
			extend: true, // Global || checks.
			interop: 'auto', // Like `tsconfig.json`.
			noConflict: true, // Like `jQuery.noConflict()`.
		},
	};
	const importedWorkerRollupConfig = {
		// Imported web workers; e.g., `?worker`.
		// See: <https://vitejs.dev/guide/features.html#web-workers>.
		output: {
			extend: true, // Global || checks.
			interop: 'auto', // Like `tsconfig.json`.
			noConflict: true, // Like `jQuery.noConflict()`.
		},
	};

	/**
	 * Configures Vite plugins.
	 *
	 * @see https://github.com/vitejs/vite-plugin-basic-ssl
	 * @see https://github.com/zhuweiyou/vite-plugin-minify
	 * @see https://github.com/trapcodeio/vite-plugin-ejs
	 */
	const pluginBasicSSLConfig = pluginBasicSSL();
	const pluginMinifyHTMLConfig = isProd ? pluginMinifyHTML() : null;
	const pluginEJSConfig = pluginEJS(
		{ NODE_ENV: nodeEnv, isProd, isDev, env, pkg }, //
		{ ejs: { root: srcDir, views: [srcDir + '/resources/ejs-views'], strict: true, localsName: '$' } },
	);
	const plugins = [pluginBasicSSLConfig, pluginEJSConfig, pluginMinifyHTMLConfig];

	/**
	 * Vite config base.
	 *
	 * @note This is extended by project configs.
	 *
	 * @see https://vitejs.dev/config/
	 */
	const baseConfig = {
		define: {
			// Static replacements.
			$$__APP_PKG_NAME__$$: pkg.name || '',
			$$__APP_PKG_VERSION__$$: pkg.version || '',
			$$__APP_PKG_REPOSITORY__$$: pkg.repository || '',
			$$__APP_PKG_HOMEPAGE__$$: pkg.homepage || '',
			$$__APP_PKG_BUGS__$$: pkg.bugs || '',
		},
		root: srcDir, // Absolute. Where entry indexes live.
		publicDir: './cargo', // Static assets relative to `root`.
		base: '/', // Analagous to `<base href="/">` — use trailing slash.

		appType: isCma ? 'custom' : 'mpa', // MPA = multipage app: <https://o5p.me/ZcTkEv>.
		resolve: { alias: aliases }, // See: `../typescript/config.json` and `./includes/aliases.js`.

		envDir: './' + path.relative(srcDir, envsDir), // Relative to `root`.
		envPrefix: publicEnvPrefix, // Part of app; i.e., visible client-side.

		server: { open: true, https: true }, // Vite dev server.
		plugins, // Additional Vite plugins that were configured above.

		esbuild: { jsx: 'automatic' }, // ← Not necessary in Vite 4.0.x.
		// See: <https://o5p.me/240y9w>, where `jsx` will be picked up from `tsconfig.json`.

		worker: {
			// Imported web workers; e.g., `?worker`.
			// See: <https://vitejs.dev/guide/features.html#web-workers>.
			plugins: [],
			format: 'es',
			rollupOptions: importedWorkerRollupConfig,
		},
		build: {
			// <https://vitejs.dev/config/build-options.html>
			emptyOutDir: true, // Must set as `true` explicitly.
			target: 'es2021', // Matches `tsconfig.json`.

			outDir: '../dist', // Relative to `root`.
			assetsDir: './assets/a16s', // Relative to `outDir`.
			// Note: `a16s` = numeronym for 'acquired resources'.

			ssr: isSSR, // Server-side rendering?
			...(isSSR ? { ssrManifest: isDev } : {}),

			sourcemap: isDev, // Enables creation of sourcemaps.
			manifest: isDev, // Enables creation of manifest for assets.

			...(isCma ? { lib: { name: cmaName, entry: cmaRelEntries } } : {}),
			rollupOptions: rollupConfig, // See: <https://o5p.me/5Vupql>.
		},
		...(isSSR
			? {
					ssr: {
						noExternal: true, // All server side.
						target: isSSRWorker ? 'webworker' : 'node',
					},
			  }
			: {}),
	};

	/**
	 * Returns final Vite config.
	 *
	 * @note Merged with project config.
	 */
	return mc.merge(baseConfig, projConfig);
};
