/**
 * Get access to the worker constructor.
 */
zone().factory("$Worker", [ '$window' ], function(window) {
    'use strict';
    return window.Worker;
});
