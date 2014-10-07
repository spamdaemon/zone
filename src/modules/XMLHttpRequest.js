/**
 * Get access the XMLHttpRequest class.
 */
zone().factory("$XMLHttpRequest", [ '$window' ], function(window) {
    'use strict';
    return window.XMLHttpRequest;
});
