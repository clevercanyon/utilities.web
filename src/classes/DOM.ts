/**
 * Clever Canyon™ {@see https://clevercanyon.com}
 *
 *  CCCCC  LL      EEEEEEE VV     VV EEEEEEE RRRRRR      CCCCC    AAA   NN   NN YY   YY  OOOOO  NN   NN ™
 * CC      LL      EE      VV     VV EE      RR   RR    CC       AAAAA  NNN  NN YY   YY OO   OO NNN  NN
 * CC      LL      EEEEE    VV   VV  EEEEE   RRRRRR     CC      AA   AA NN N NN  YYYYY  OO   OO NN N NN
 * CC      LL      EE        VV VV   EE      RR  RR     CC      AAAAAAA NN  NNN   YYY   OO   OO NN  NNN
 *  CCCCC  LLLLLLL EEEEEEE    VVV    EEEEEEE RR   RR     CCCCC  AA   AA NN   NN   YYY    OOOO0  NN   NN
 */
// <editor-fold desc="Imports and other headers.">

/**
 * Imports.
 *
 * @since 2022-04-25
 */
import { default as uA6tBase } from '../../any/classes/a6t/Base';

// </editor-fold>

/**
 * DOM utilities.
 *
 * @since 2022-04-25
 */
export default class wDOM extends uA6tBase {
	/**
	 * Fires a callback on document ready state.
	 *
	 * @since 2022-04-25
	 *
	 * @param {function} callback Callback.
	 */
	public static onDocReady( callback : () => void ) : void {
		if ( 'loading' !== document.readyState ) {
			callback(); // Fires callback immediately.
		} else {
			document.addEventListener( 'DOMContentLoaded', () => callback() );
		}
	}

	/**
	 * Fires a callback on window loaded state.
	 *
	 * @since 2022-04-25
	 *
	 * @param {function} callback Callback.
	 */
	public static onWinLoaded( callback : () => void ) {
		if ( 'complete' === document.readyState ) {
			callback(); // Fires callback immediately.
		} else {
			window.addEventListener( 'load', () => callback() );
		}
	}

	/**
	 * Fires a callback on an event.
	 *
	 * @since 2022-04-25
	 *
	 * @param {string}          eventName          Event name. Required always.
	 * @param {string|function} selectorOrCallback Selector for delegated events; else callback.
	 * @param {function}        [callback]         Optional third parameter as callback when `selectorOrCallback` is `selector`.
	 */
	public static on( eventName : string, callback : ( $ : Event ) => void ) : void;
	public static on( eventName : string, selector : string, callback : ( $ : Event ) => void ) : void;

	public static on( eventName : string, selectorOrCallback : string | ( ( $ : Event ) => void ), callback? : ( $ : Event ) => void ) : void {
		if ( 2 === arguments.length ) {
			callback = arguments[ 1 ] as ( $ : Event ) => void;
			document.addEventListener( eventName, callback );

		} else if ( 3 === arguments.length ) {
			const selector = selectorOrCallback as string;

			document.addEventListener( eventName, ( event : Event ) : void => {
				let target = event.target;

				if ( ! ( target instanceof HTMLElement ) ) {
					return; // Not applicable.
				}
				do {
					if ( target.matches( selector ) && callback ) {
						callback.call( target, event );
					}
				} while ( ( target = target.parentNode ) instanceof HTMLElement && target !== event.currentTarget );
			} );
		} else {
			throw new Error( 'Invalid call signature.' );
		}
	}

	/**
	 * Debounce handler.
	 *
	 * @since 2022-04-25
	 *
	 * @param {function} callback          Callback.
	 * @param {number}   [delay=100]       Optional delay. Default is `100`.
	 * @param {boolean}  [immediate=false] Immediate? Default is `false`.
	 *
	 * @returns {function} Debouncer.
	 */
	public static debounce( callback : () => void, delay : number = 100, immediate : boolean = false ) {
		let timeout : number | undefined;

		return function ( this : unknown, ...args : [] ) {
			const afterDelay = () => {
				if ( ! immediate ) {
					callback.apply( this, args );
				}
				timeout = undefined;
			};
			if ( timeout ) {
				window.clearTimeout( timeout );
			} else if ( immediate ) {
				callback.apply( this, args );
			}
			timeout = window.setTimeout( afterDelay, delay );
		};
	}

	/**
	 * Attaches an element to `<head>`.
	 *
	 * @since 2022-04-25
	 *
	 * @param {HTMLElement} element Element to attach.
	 */
	public static attachToHead( element : HTMLElement ) : void {
		document.getElementsByTagName( 'head' )[ 0 ].appendChild( element );
	}

	/**
	 * Attaches an element to `<body>`.
	 *
	 * @since 2022-04-25
	 *
	 * @param {HTMLElement} element Element to attach.
	 */
	public static attachToBody( element : HTMLElement ) : void {
		document.getElementsByTagName( 'body' )[ 0 ].appendChild( element );
	}

	/**
	 * Attaches a `<script>` to `<body>`.
	 *
	 * @since 2022-04-25
	 *
	 * @param {string}                                     src     Script source.
	 * @param {object<string,function|string|mumber|true>} [attrs] Optional attributes. Default is `{}`.
	 */
	public static attachScript( src : string, attrs : { [ $ : string ] : ( ( $ : Event ) => void ) | string | number | true } = {} ) : void {
		wDOM.attachToBody( wDOM.createElement( 'script', Object.assign( {}, attrs, { src : src, async : true } ) ) );
	}

	/**
	 * Create a new HTML element.
	 *
	 * @since 2022-04-25
	 *
	 * @param {string}                                     tag     Tag name.
	 * @param {object<string,function|string|number|true>} [attrs] Optional attributes. Default is `{}`.
	 *
	 * @return {HTMLElement} HTML element.
	 */
	public static createElement( tag : string, attrs? : { [ $ : string ] : ( ( $ : Event ) => void ) | string | number | true } ) : HTMLElement {
		const element = document.createElement( tag );

		for ( const attr in attrs ) {
			if ( typeof attrs[ attr ] === 'function' ) {
				// @ts-ignore -- Cannot filter writable keys only.
				element[ attr as keyof HTMLElement ] = attrs[ attr ];
			}
		}
		for ( const attr in attrs ) {
			if ( true === attrs[ attr ] ) {
				element.setAttribute( attr, '' );
			} else if ( [ 'string', 'number' ].indexOf( typeof attrs[ attr ] ) !== -1 ) {
				element.setAttribute( attr, String( attrs[ attr ] ) );
			}
		}
		return element;
	}
}
