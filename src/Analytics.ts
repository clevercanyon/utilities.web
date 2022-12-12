/**
 * Utility class.
 */

import { $Cookie, $URL } from '@clevercanyon/utilities';
import { default as DOM } from './DOM';

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
 * Constructor props.
 */
interface AnalyticsConstructorProps {
	debug?: boolean;
	csGDPRScriptId?: string;
	ga4GtagId?: string;
	context?: string;
	subContext?: string;
	userId?: string;
}

/**
 * Geo data.
 *
 *     {
 *     	"colo": "ATL",
 *     	"country": "US",
 *     	"city": "Alpharetta",
 *     	"continent": "NA",
 *     	"latitude": "34.02400",
 *     	"longitude": "-84.23960",
 *     	"postalCode": "30022",
 *     	"metroCode": "524",
 *     	"region": "Georgia",
 *     	"regionCode": "GA",
 *     	"timezone": "America/New_York"
 *     }
 */
interface AnalyticsGeoData {
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
 * Analytics.
 */
export default class Analytics {
	/**
	 * Cache.
	 */
	protected cache: {
		geoData?: AnalyticsGeoData;
		[$: string]: unknown;
	} = {};

	/**
	 * Gtag instance.
	 */
	protected gtag: (...args: Array<unknown>) => null;

	/**
	 * Enable debug mode?
	 */
	protected debug: boolean;

	/**
	 * GA4 gtag ID; e.g., `G-8K3F2ZYNYX`.
	 */
	protected ga4GtagId: string;

	/**
	 * Cookie Script GDPR script ID.
	 *
	 * E.g., `ecf9ba42a3e03d5dd3894e6e`.
	 */
	protected csGDPRScriptId: string;

	/**
	 * Context; e.g., `web`.
	 */
	protected context: string;

	/**
	 * Sub-context; e.g., `site`.
	 */
	protected subContext: string;

	/**
	 * User ID hash; e.g., SHA-256.
	 */
	protected _userId: string;

	/**
	 * Constructor.
	 *
	 * @param config Config.
	 */
	public constructor(config: AnalyticsConstructorProps) {
		config = Object.assign(
			{
				debug: false,
				csGDPRScriptId: '',
				ga4GtagId: '',
				context: 'web',
				subContext: 'site',
				userId: '',
			},
			config,
		);
		this.debug = config.debug || false;
		this.csGDPRScriptId = config.csGDPRScriptId || '';
		this.ga4GtagId = config.ga4GtagId || '';
		this.context = config.context || 'web';
		this.subContext = config.subContext || 'site';
		this._userId = config.userId || '';

		if (!this.ga4GtagId) {
			throw new Error('Missing required property: `ga4GtagId`.');
		}
		window.dataLayer = window.dataLayer || [];
		window.gtag =
			window.gtag ||
			function (...args) {
				window.dataLayer.push(args);
			};
		this.gtag = window.gtag; // Private reference.

		DOM.onWinLoaded(() => this.loadThenInitialize());
	}

	/**
	 * Gets user ID hash.
	 *
	 * @returns User ID hash.
	 */
	public async userId(): Promise<string> {
		return this._userId; // Async = uniformity.
	}

	/**
	 * Gets client ID.
	 *
	 * @returns Client ID; e.g., `826737564.1651025377`.
	 */
	public async clientId(): Promise<string> {
		return new Promise((resolve) => {
			this.gtag('get', this.ga4GtagId, 'client_id', resolve) || '';
		});
	}

	/**
	 * Gets session ID.
	 *
	 * @returns Session ID; e.g., `1651031160`.
	 */
	public async sessionId(): Promise<string> {
		return new Promise((resolve) => {
			this.gtag('get', this.ga4GtagId, 'session_id', resolve) || '';
		});
	}

	/**
	 * Gets geolocation data.
	 *
	 * @returns Geolocation data.
	 */
	public async geoData(): Promise<AnalyticsGeoData> {
		if (this.cache.geoData) {
			return this.cache.geoData;
		}
		return fetch('https://wobots.com/api/ip-geo/v1')
			.then((response) => response.json())
			.then((json) => (this.cache.geoData = json as AnalyticsGeoData));
	}

	/**
	 * Tracks a `page_view` event.
	 *
	 * @param   props Optional event props.
	 *
	 * @returns       `true` on success.
	 */
	public async trackPageView(props: { [$: string]: unknown } = {}): Promise<boolean> {
		if ($URL.getQueryVar('utm_source')) {
			$Cookie.set('utx_touch', JSON.stringify(this.utmXQueryVars(), null, 2));
		}
		return this.trackEvent('page_view', props);
	}

	/**
	 * Tracks an `x_click` event.
	 *
	 * @param   event Click event.
	 * @param   props Optional event props.
	 *
	 * @returns       `true` on success.
	 */
	public async trackClick(event: Event, props: { [$: string]: unknown } = {}): Promise<boolean> {
		const element = event.target as HTMLElement;
		const idAttr = element.getAttribute('id') || '';
		const classAttr = element.getAttribute('class') || '';

		return this.trackEvent('x_click', {
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
	public async trackEvent(name: string, props: { [$: string]: unknown } = {}): Promise<boolean> {
		return Promise.all([this.userId(), this.clientId(), this.sessionId()]).then(([userId, clientId, sessionId]) => {
			this.gtag('event', name, {
				send_to: [this.ga4GtagId],

				x_client_id: clientId,
				x_session_id: sessionId,
				...(userId ? { user_id: userId } : null),
				...(userId ? { user_properties: { x_user_id: userId } } : null),

				x_context: this.context,
				x_sub_context: this.subContext,
				x_hostname: $URL.currentHost(false),

				...this.utmXQueryVarDimensions(),
				...props,
			});
			return true;
		});
	}

	/**
	 * DNT header indicates 'Do Not Track'?
	 *
	 * @returns `true` is DNT header exists.
	 *
	 * @see https://o5p.me/Fg9eaO
	 */
	public userHasDoNotTrackHeader(): boolean {
		return '1' === window.doNotTrack || (window.navigator && '1' === navigator.doNotTrack);
	}

	/**
	 * Loads analytics.
	 */
	protected loadThenInitialize(): void {
		void this.geoData().then((geoData) => {
			if ('US' !== geoData.country || this.userHasDoNotTrackHeader() || /^\/(?:privacy|cookies?)(?:[_-]policy)?(?:$|\/)/iu.test($URL.currentPath())) {
				this.gtag('consent', 'default', {
					wait_for_update: 500,
					ad_storage: 'denied',
					analytics_storage: 'denied',
					functionality_storage: 'denied',
					personalization_storage: 'denied',
					security_storage: 'denied',
				});
				if (this.csGDPRScriptId) {
					// See: <https://cookie-script.com/web-cookie-types>.
					// See: <https://support.google.com/analytics/answer/9976101?hl=en>.
					DOM.attachScript('https://cdn.cookie-script.com/s/' + $URL.encode(this.csGDPRScriptId) + '.js', {
						onload: () => this.initialize(),
					});
				}
			} else {
				void this.initialize();
			}
		});
	}

	/**
	 * Initializes analytics.
	 */
	protected initialize(): void {
		// GA4 initialize, configuration, and load JS.

		// This must fire *after* `gtag( 'consent', ...` setup.
		// See: <https://o5p.me/Dc5cKA> <https://o5p.me/mW2tgB>.
		this.gtag('js', new Date()); // Fires `gtm.js` event and sets `gtm.start` timer.

		this.gtag('config', this.ga4GtagId, {
			groups: ['default'],
			ads_data_redaction: true,
			send_page_view: false,
			url_passthrough: false,
			allow_google_signals: false,
			allow_ad_personalization_signals: false,
			debug_mode: this.debug,
		});
		DOM.attachScript('https://www.googletagmanager.com/gtag/js?id=' + $URL.encode(this.ga4GtagId));

		// Initialize trackers.

		void this.trackPageView(); // Initial page view.
		DOM.on('click', 'a, button, input[type="button"], input[type="submit"]', (event) => void this.trackClick(event));
	}

	/**
	 * Gets `ut[mx]_*` query variables.
	 *
	 * @returns `ut[mx]_*` query variables.
	 */
	protected utmXQueryVars(): { [$: string]: string } {
		return $URL.getQueryVars(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utx_ref']);
	}

	/**
	 * Gets `x_ut[mx]_*` query variable dimensions.
	 *
	 * @returns `x_ut[mx]_*` query variable dimensions.
	 */
	protected utmXQueryVarDimensions(): { [$: string]: string } {
		const dimensions: { [$: string]: string } = {};
		const queryVars = this.utmXQueryVars();

		for (const [name, value] of Object.entries(queryVars)) {
			dimensions['x_' + name] = String(value);
		}
		return dimensions;
	}
}
