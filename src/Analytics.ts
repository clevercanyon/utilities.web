/**
 * Utility class.
 */

import {
	currentHost as $urlꓺcurrentHost,
	currentPath as $urlꓺcurrentPath,
	getQueryVar as $urlꓺgetQueryVar,
	getQueryVars as $urlꓺgetQueryVars,
	encode as $urlꓺencode,
} from '@clevercanyon/utilities/url';

import { get as $envꓺget } from '@clevercanyon/utilities/env';
import { get as $cookieꓺget, set as $cookieꓺset } from '@clevercanyon/utilities/cookie';

import { $dom } from './index.js';

/**
 * Window.
 */
declare global {
	interface Window {
		doNotTrack: string;
		dataLayer: Array<unknown>;
		gtag: (...args: Array<unknown>) => null;
	}
}

/**
 * Setup options.
 */
interface SetupOptions {
	debug?: boolean;
	csGDPRScriptId?: string;
	ga4GtagId?: string;
	context?: string;
	subContext?: string;
	userId?: string;
}

/**
 * Config options.
 */
interface ConfigOptions {
	debug: boolean;
	csGDPRScriptId: string;
	ga4GtagId: string;
	context: string;
	subContext: string;
	userId: string;
}

/**
 * Geo data.
 */
interface GeoData {
	colo?: string;
	country?: string;
	city?: string;
	continent?: string;
	latitude?: string;
	longitude?: string;
	postalCode?: string;
	metroCode?: string;
	region?: string;
	regionCode?: string;
	timezone?: string;
}

/**
 * Is setup?
 */
let isSetup = false;

/**
 * Setup-related errors.
 */
const alreadySetupError = new Error('Already set up.');
const notSetupError = new Error('Not set up.');

/**
 * Cache.
 */
const cache: {
	geoData?: GeoData;
	[$: string]: unknown;
} = {};

/**
 * Config options.
 */
const config: ConfigOptions = {
	debug: Boolean($envꓺget('APP_PUBLIC_ANALYTICS_DEBUG') || false),
	ga4GtagId: String($envꓺget('APP_PUBLIC_ANALYTICS_GA4_GTAG_ID') || ''),
	csGDPRScriptId: String($envꓺget('APP_PUBLIC_ANALYTICS_CS_GDPR_SCRIPT_ID') || ''),
	context: String($envꓺget('APP_PUBLIC_ANALYTICS_CONTEXT') || 'web'),
	subContext: String($envꓺget('APP_PUBLIC_ANALYTICS_SUB_CONTEXT') || 'site'),
	userId: String($cookieꓺget('utx_user_id') || ''),
};

/**
 * Sets up analytics.
 *
 * @param options Optional setup options.
 */
export function setup(options: SetupOptions = {}) {
	if (isSetup) {
		throw alreadySetupError;
	}
	isSetup = true; // Doing now.

	Object.assign(config, options);

	if (!config.ga4GtagId) {
		throw new Error('Missing `ga4GtagId`.');
	}
	window.dataLayer = window.dataLayer || [];
	window.gtag =
		window.gtag ||
		function (...args) {
			window.dataLayer.push(args);
		};
	$dom.onWinLoaded(() => loadThenInitialize());
}

/**
 * Gets user ID hash.
 *
 * @returns User ID hash.
 */
export async function userId(): Promise<string> {
	if (!isSetup) {
		throw notSetupError;
	}
	return config.userId; // Async = uniformity.
}

/**
 * Gets client ID.
 *
 * @returns Client ID; e.g., `826737564.1651025377`.
 */
export async function clientId(): Promise<string> {
	if (!isSetup) {
		throw notSetupError;
	}
	return new Promise((resolve) => {
		window.gtag('get', config.ga4GtagId, 'client_id', resolve);
	}).then((value: unknown): string => String(value || ''));
}

/**
 * Gets session ID.
 *
 * @returns Session ID; e.g., `1651031160`.
 */
export async function sessionId(): Promise<string> {
	if (!isSetup) {
		throw notSetupError;
	}
	return new Promise((resolve) => {
		window.gtag('get', config.ga4GtagId, 'session_id', resolve);
	}).then((value: unknown): string => String(value || ''));
}

/**
 * Gets geolocation data.
 *
 * @returns Geolocation data.
 */
export async function geoData(): Promise<GeoData> {
	if (!isSetup) {
		throw notSetupError;
	}
	if (cache.geoData) {
		return cache.geoData;
	}
	return fetch('https://wobots.com/api/ip-geo/v1')
		.then((response) => response.json())
		.then((json) => (cache.geoData = json as GeoData));
}

/**
 * Tracks a `page_view` event.
 *
 * @param   props Optional event props.
 *
 * @returns       `true` on success.
 */
export async function trackPageView(props: { [$: string]: unknown } = {}): Promise<boolean> {
	if (!isSetup) {
		throw notSetupError;
	}
	if ($urlꓺgetQueryVar('utm_source')) {
		$cookieꓺset('utx_touch', JSON.stringify(utmXQueryVars(), null, 2));
	}
	return trackEvent('page_view', props);
}

/**
 * Tracks an `x_click` event.
 *
 * @param   event Click event.
 * @param   props Optional event props.
 *
 * @returns       `true` on success.
 */
export async function trackClick(event: Event, props: { [$: string]: unknown } = {}): Promise<boolean> {
	if (!isSetup) {
		throw notSetupError;
	}
	const element = event.target as HTMLElement;
	const idAttr = element.getAttribute('id') || '';
	const classAttr = element.getAttribute('class') || '';

	return trackEvent('x_click', {
		x_flex_id: idAttr || (/(?:^|\s)click-id=([a-z0-9_-]+)(?:$|\s)/iu.exec(classAttr) || [])[1] || null,
		x_flex_sub_id: element.getAttribute('href'), // In the case of `<a>` tags.

		x_flex_value: element.getAttribute('title') || (element.innerText || '').replace(/\s+/gu, ' ').trim() || element.getAttribute('value'),
		x_flex_sub_value: element.tagName.toLowerCase(),

		...props,
	});
}

/**
 * Tracks an event.
 *
 * @param   name  A standard or custom event name. Please prefix custom event names with `x_`.
 * @param   props Optional event props.
 *
 * @returns       `true` on success.
 */
export async function trackEvent(name: string, props: { [$: string]: unknown } = {}): Promise<boolean> {
	if (!isSetup) {
		throw notSetupError;
	}
	return Promise.all([userId(), clientId(), sessionId()]).then(([userId, clientId, sessionId]) => {
		window.gtag('event', name, {
			send_to: [config.ga4GtagId],

			x_client_id: clientId,
			x_session_id: sessionId,
			...(userId ? { user_id: userId } : null),
			...(userId ? { user_properties: { x_user_id: userId } } : null),

			x_context: config.context,
			x_sub_context: config.subContext,
			x_hostname: $urlꓺcurrentHost(false),

			...utmXQueryVarDimensions(),
			...props,
		});
		return true;
	});
}

/**
 * DNT header indicates 'Do Not Track'?
 *
 * @returns `true` when DNT header exists.
 *
 * @see https://o5p.me/Fg9eaO
 */
function userHasDoNotTrackHeader(): boolean {
	if (!isSetup) {
		throw notSetupError;
	}
	return '1' === window.doNotTrack || (window.navigator && '1' === navigator.doNotTrack);
}

/**
 * Loads analytics.
 */
function loadThenInitialize(): void {
	if (!isSetup) {
		throw notSetupError;
	}
	void geoData().then((geoData) => {
		if ('US' !== geoData.country || userHasDoNotTrackHeader() || /^\/(?:privacy|cookies?)(?:[_-]policy)?(?:$|\/)/iu.test($urlꓺcurrentPath())) {
			window.gtag('consent', 'default', {
				wait_for_update: 500,
				ad_storage: 'denied',
				analytics_storage: 'denied',
				functionality_storage: 'denied',
				personalization_storage: 'denied',
				security_storage: 'denied',
			});
			if (config.csGDPRScriptId) {
				// See: <https://cookie-script.com/web-cookie-types>.
				// See: <https://support.google.com/analytics/answer/9976101?hl=en>.
				$dom.attachScript('https://cdn.cookie-script.com/s/' + $urlꓺencode(config.csGDPRScriptId) + '.js', {
					onload: () => initialize(),
				});
			}
		} else {
			void initialize();
		}
	});
}

/**
 * Initializes analytics.
 */
function initialize(): void {
	if (!isSetup) {
		throw notSetupError;
	}
	// This must fire *after* `window.gtag( 'consent', ...`.
	// See: <https://o5p.me/Dc5cKA> <https://o5p.me/mW2tgB>.
	window.gtag('js', new Date()); // Fires `gtm.js` and sets `gtm.start` timer.

	window.gtag('config', config.ga4GtagId, {
		groups: ['default'],
		ads_data_redaction: true,
		send_page_view: false,
		url_passthrough: false,
		allow_google_signals: false,
		allow_ad_personalization_signals: false,
		debug_mode: config.debug,
	});
	$dom.attachScript('https://www.googletagmanager.com/gtag/js?id=' + $urlꓺencode(config.ga4GtagId));

	// Initialize trackers.

	void trackPageView(); // Initial page view.
	$dom.on('click', 'a, button, input[type="button"], input[type="submit"]', (event) => void trackClick(event));
}

/**
 * Gets `ut[mx]_*` query variables.
 *
 * @returns `ut[mx]_*` query variables.
 */
function utmXQueryVars(): { [$: string]: string } {
	if (!isSetup) {
		throw notSetupError;
	}
	return $urlꓺgetQueryVars(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utx_ref']);
}

/**
 * Gets `x_ut[mx]_*` query variable dimensions.
 *
 * @returns `x_ut[mx]_*` query variable dimensions.
 */
function utmXQueryVarDimensions(): { [$: string]: string } {
	if (!isSetup) {
		throw notSetupError;
	}
	const dimensions: { [$: string]: string } = {};
	const queryVars = utmXQueryVars();

	for (const [name, value] of Object.entries(queryVars)) {
		dimensions['x_' + name] = String(value);
	}
	return dimensions;
}
