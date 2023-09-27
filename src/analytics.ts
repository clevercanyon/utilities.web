/**
 * Utility class.
 */

import './resources/init-env.ts';

import { $cookie, $env, $is, $obj, $str, $url } from '@clevercanyon/utilities';
import { $dom } from './index.ts';

let config: Config;
let isSetupComplete = false;

const notSetUpErrorMsg = 'Analytics not set up yet.';
const cache: { geoData?: GeoData; [x: string]: unknown } = {};

/**
 * Defines types.
 */
declare global {
    interface Window {
        doNotTrack: string;
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => null;
    }
}
export type Config = {
    debug: boolean;
    csGDPRScriptId: string;
    ga4GtagId: string;
    context: string;
    subContext: string;
    userId: string;
};
export type GeoData = {
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
};

/**
 * Sets up analytics.
 *
 * @param configOpts Options (all optional).
 */
export const setup = (configOpts?: Partial<Config>): void => {
    if (isSetupComplete) {
        throw new Error('Already set up.');
    }
    isSetupComplete = true; // Setting up now.

    config = $obj.defaults({}, configOpts || {}, {
        debug: $env.get('APP_ANALYTICS_DEBUG', { type: 'boolean', default: false }),
        ga4GtagId: $env.get('APP_ANALYTICS_GA4_GTAG_ID', { type: 'string', default: '' }),
        csGDPRScriptId: $env.get('APP_ANALYTICS_CS_GDPR_SCRIPT_ID', { type: 'string', default: '' }),
        context: $env.get('APP_ANALYTICS_CONTEXT', { type: 'string', default: 'web' }),
        subContext: $env.get('APP_ANALYTICS_SUB_CONTEXT', { type: 'string', default: 'site' }),
        userId: $cookie.get('utx_user_id', ''),
    }) as Config;

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
};

/**
 * Gets user ID hash.
 *
 * @returns User ID hash.
 */
export const userId = async (): Promise<string> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    return config.userId; // Async uniformity.
};

/**
 * Gets client ID.
 *
 * @returns Client ID; e.g., `826737564.1651025377`.
 */
export const clientId = async (): Promise<string> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    return new Promise((resolve) => {
        window.gtag('get', config.ga4GtagId, 'client_id', resolve);
    }).then((value: unknown): string => String(value || ''));
};

/**
 * Gets session ID.
 *
 * @returns Session ID; e.g., `1651031160`.
 */
export const sessionId = async (): Promise<string> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    return new Promise((resolve) => {
        window.gtag('get', config.ga4GtagId, 'session_id', resolve);
    }).then((value: unknown): string => String(value || ''));
};

/**
 * Gets geolocation data.
 *
 * @returns Geolocation data.
 */
export const geoData = async (): Promise<GeoData> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    if (cache.geoData) {
        return cache.geoData;
    }
    return fetch('https://wobots.com/api/ip-geo/v1') // @todo Update this endpoint.
        .then((response) => response.json())
        .then((json) => (cache.geoData = json as GeoData));
};

/**
 * Tracks a `page_view` event.
 *
 * @param   props Optional event props.
 *
 * @returns       True on success.
 */
export const trackPageView = async (props: { [$: string]: unknown } = {}): Promise<boolean> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    if ($url.getQueryVar('utm_source')) {
        $cookie.set('utx_touch', JSON.stringify(utmXQueryVars(), null, 2));
    }
    return trackEvent('page_view', props);
};

/**
 * Tracks an `x_click` event.
 *
 * @param   event Click event.
 * @param   props Optional event props.
 *
 * @returns       True on success.
 *
 * @see https://support.google.com/analytics/answer/9267744?hl=en
 */
export const trackClick = async (event: Event, props: { [$: string]: unknown } = {}): Promise<boolean> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    const element = event.target as HTMLElement;
    const idAttr = element.getAttribute('id') || '';
    const classAttr = element.getAttribute('class') || '';

    return trackEvent('x_click', {
        x_flex_id: $str.clip(idAttr || (/(?:^|\s)click-id=([a-z0-9_-]+)(?:$|\s)/iu.exec(classAttr) || [])[1] || '', { maxChars: 100 }),
        x_flex_sub_id: $str.clip(element.getAttribute('href') || '', { maxChars: 100 }), // In the case of `<a>` tags.

        x_flex_value: $str.clip(element.getAttribute('title') || (element.innerText || '').replace(/\s+/gu, ' ').trim() || element.getAttribute('value') || '', { maxChars: 100 }),
        x_flex_sub_value: $str.clip(element.tagName.toLowerCase() || '', { maxChars: 100 }),

        ...props, // Any additional props passed in.
    });
};

/**
 * Tracks an event.
 *
 * @param   name  Standard or custom event name.
 *
 *   - Please be sure to prefix custom event names with `x_`.
 *
 * @param   props Optional event props.
 *
 * @returns       True on success.
 *
 * @see https://support.google.com/analytics/answer/9267744?hl=en
 */
export const trackEvent = async (name: string, props: { [$: string]: unknown } = {}): Promise<boolean> => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    if ($str.charLength(name) > 40) {
        throw new Error('Event name exceeds 40 chars.');
    }
    return Promise.all([userId(), clientId(), sessionId()]).then(([userId, clientId, sessionId]) => {
        if ($str.charLength(userId) > 36) {
            throw new Error('`userId` exceeds limit of 36 chars.');
        }
        const eventData = {
            send_to: [config.ga4GtagId],

            x_client_id: $str.clip(clientId, { maxChars: 100 }),
            x_session_id: $str.clip(sessionId, { maxChars: 100 }),

            ...(userId ? { user_id: $str.clip(userId, { maxChars: 256 }) } : undefined),
            ...(userId ? { user_properties: { x_user_id: $str.clip(userId, { maxChars: 36 }) } } : undefined),

            x_context: $str.clip(config.context, { maxChars: 100 }),
            x_sub_context: $str.clip(config.subContext, { maxChars: 100 }),
            x_hostname: $str.clip($url.currentHost({ withPort: false }), { maxChars: 100 }),

            ...utmXQueryVarDimensions(),
            ...props, // Any additional props passed in.
        };
        if (Object.keys(eventData).length > 25) {
            throw new Error('Event data exceeds total limit of 25 parameters.');
        }
        for (const [key, value] of Object.entries(eventData)) {
            if ($str.charLength(key) > 40) throw new Error('Event parameter `' + key + '` exceeds name limit of 40 chars.');
            if ($is.string(value) && $str.charLength(value) > 100) throw new Error('Event parameter `' + key + '` exceeds value limit of 100 chars.');
        }
        window.gtag('event', name, eventData);

        return true;
    });
};

/**
 * DNT header indicates 'Do Not Track'?
 *
 * @returns True when DNT header exists.
 *
 * @see https://o5p.me/Fg9eaO
 */
const userHasDoNotTrackHeader = (): boolean => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    return '1' === window.doNotTrack || (window.navigator && '1' === navigator.doNotTrack);
};

/**
 * Loads analytics.
 */
const loadThenInitialize = (): void => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    void geoData().then((geoData) => {
        if ('US' !== geoData.country || userHasDoNotTrackHeader() || /^\/(?:privacy|cookies?)(?:[_-]policy)?(?:$|\/)/iu.test($url.currentPath())) {
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
                $dom.attachScript('https://cdn.cookie-script.com/s/' + $url.encode(config.csGDPRScriptId) + '.js', {
                    onload: () => initialize(),
                });
            }
        } else {
            void initialize();
        }
    });
};

/**
 * Initializes analytics.
 */
const initialize = (): void => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
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
    $dom.attachScript('https://www.googletagmanager.com/gtag/js?id=' + $url.encode(config.ga4GtagId));

    // Initialize trackers.

    void trackPageView(); // Initial page view.
    $dom.on('click', 'a, button, input[type="button"], input[type="submit"]', (event: Event) => void trackClick(event));
};

/**
 * Gets `ut[mx]_*` query variables.
 *
 * @returns `ut[mx]_*` query variables.
 */
const utmXQueryVars = (): { readonly [$: string]: string } => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    return $url.getQueryVars(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utx_ref']);
};

/**
 * Gets `x_ut[mx]_*` query variable dimensions.
 *
 * @returns `x_ut[mx]_*` query variable dimensions.
 */
const utmXQueryVarDimensions = (): { readonly [$: string]: string } => {
    if (!isSetupComplete) {
        throw new Error(notSetUpErrorMsg);
    }
    const dimensions: { [$: string]: string } = {};
    const queryVars = utmXQueryVars();

    for (const [name, value] of Object.entries(queryVars)) {
        dimensions['x_' + name] = $str.clip(String(value), { maxChars: 100 });
    }
    return dimensions;
};
