/**
 * Utility class.
 */

import './resources/init-env.ts';

import { function as $isꓺfunction, number as $isꓺnumber, string as $isꓺstring } from '@clevercanyon/utilities/is';

/**
 * Fires a callback on document ready state.
 *
 * @param callback Callback.
 */
export const onDocReady = (callback: () => void): void => {
	if ('loading' !== document.readyState) {
		callback(); // Fires callback immediately.
	} else {
		document.addEventListener('DOMContentLoaded', () => callback());
	}
};

/**
 * Fires a callback on window loaded state.
 *
 * @param callback Callback.
 */
export const onWinLoaded = (callback: () => void) => {
	if ('complete' === document.readyState) {
		callback(); // Fires callback immediately.
	} else {
		window.addEventListener('load', () => callback());
	}
};

/**
 * Fires a callback on an event.
 *
 * @param eventName          Event name. Required always.
 * @param selectorOrCallback Selector for delegated events; else callback.
 * @param callback           Optional third parameter as callback when `selectorOrCallback` is `selector`.
 */
export function on(eventName: string, callback: ($: Event) => void): void;
export function on(eventName: string, selector: string, callback: ($: Event) => void): void;

export function on(eventName: string, selectorOrCallback: string | (($: Event) => void), callback?: ($: Event) => void): void {
	if (2 === arguments.length) {
		document.addEventListener(eventName, selectorOrCallback as ($: Event) => void);
		//
	} else if (3 === arguments.length) {
		const selector = selectorOrCallback as string;

		document.addEventListener(eventName, (event: Event): void => {
			let target = event.target;

			if (!(target instanceof HTMLElement)) {
				return; // Not applicable.
			}
			do {
				if (target.matches(selector) && callback) {
					callback.call(target, event);
				}
			} while ((target = target.parentNode) instanceof HTMLElement && target !== event.currentTarget);
		});
	} else {
		throw new Error('Invalid call signature.');
	}
}

/**
 * Attaches an element to `<head>`.
 *
 * @param element Element to attach.
 */
export const attachToHead = (element: HTMLElement): void => {
	document.getElementsByTagName('head')[0].appendChild(element);
};

/**
 * Attaches an element to `<body>`.
 *
 * @param element Element to attach.
 */
export const attachToBody = (element: HTMLElement): void => {
	document.getElementsByTagName('body')[0].appendChild(element);
};

/**
 * Attaches a `<script>` to `<body>`.
 *
 * @param src   Script source.
 * @param attrs Optional attributes. Default is `{}`.
 */
export const attachScript = (src: string, attrs: { [$: string]: (($: Event) => void) | string | number | true } = {}): void => {
	attachToBody(createElement('script', Object.assign({}, attrs, { src: src, async: true })));
};

/**
 * Create a new HTML element.
 *
 * @param   tag   Tag name.
 * @param   attrs Optional attributes. Default is `{}`.
 *
 * @returns       HTML element.
 */
export const createElement = (tag: string, attrs?: { [$: string]: (($: Event) => void) | string | number | true }): HTMLElement => {
	const element = document.createElement(tag);

	for (const attr in attrs) {
		if ($isꓺfunction(attrs[attr])) {
			// @ts-ignore -- Readonly warning OK to ignore.
			element[attr as keyof HTMLElement] = attrs[attr];
		}
	}
	for (const attr in attrs) {
		if (true === attrs[attr]) {
			element.setAttribute(attr, '');
			//
		} else if ($isꓺstring(attrs[attr]) || $isꓺnumber(attrs[attr])) {
			element.setAttribute(attr, String(attrs[attr]));
		}
	}
	return element;
};
