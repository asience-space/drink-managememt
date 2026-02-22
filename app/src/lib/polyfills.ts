/**
 * Polyfills for iOS 12 (Safari 12) and other legacy browsers
 *
 * This file imports necessary polyfills from core-js to support:
 * - ES2015+ features not available in older browsers
 * - Promise, Array methods, Object methods, etc.
 */

// Promise polyfills
import 'core-js/actual/promise';
import 'core-js/actual/promise/all-settled';

// Array methods
import 'core-js/actual/array/flat';
import 'core-js/actual/array/flat-map';
import 'core-js/actual/array/from';
import 'core-js/actual/array/includes';

// Object methods
import 'core-js/actual/object/assign';
import 'core-js/actual/object/entries';
import 'core-js/actual/object/from-entries';
import 'core-js/actual/object/values';

// String methods
import 'core-js/actual/string/includes';
import 'core-js/actual/string/starts-with';
import 'core-js/actual/string/ends-with';
import 'core-js/actual/string/repeat';
import 'core-js/actual/string/pad-start';
import 'core-js/actual/string/pad-end';

// Symbol
import 'core-js/actual/symbol';

// URL and URLSearchParams
import 'core-js/actual/url';
import 'core-js/actual/url-search-params';

// globalThis
import 'core-js/actual/global-this';
