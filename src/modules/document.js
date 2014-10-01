/**
 * Access the window's document.
 */
zone().factory("$document", [ '$window' ], function(window) {
    'use strict';
    return window.document;
});
