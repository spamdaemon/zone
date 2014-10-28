/**
 * Get access to the worker constructor.
 */
zone().factory("$Math", [ '$window' ], function(window) {
    'use strict';
    return window.Math;
});
