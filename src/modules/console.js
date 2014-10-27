/**
 * Make the console available as a top-level zone object. The console is polyfilled via code found here:
 * 
 * <pre>
 * Console-polyfill. MIT license.
 * https://github.com/paulmillr/console-polyfill
 * Make it safe to do console.log() always.
 * </pre>
 * 
 */
zone().factory(
        "$console",
        [ '$window' ],
        function(window) {
            'use strict';
            var con = window.console || {};
            var prop, method;
            var empty = {};
            var dummy = function() {
            };
            var properties = 'memory'.split(',');
            var methods = ('assert,clear,count,debug,dir,dirxml,error,exception,group,'
                    + 'groupCollapsed,groupEnd,info,log,markTimeline,profile,profiles,profileEnd,'
                    + 'show,table,time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn').split(',');
            while ((prop = properties.pop()))
                con[prop] = con[prop] || empty;
            while ((method = methods.pop()))
                con[method] = con[method] || dummy;

            return con;
        });
