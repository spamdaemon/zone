/**
 * Access the indexed DB database.
 */
zone().factory("$indexedDB", [ '$window' ], function(window) {
    'use strict';
    return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
});
