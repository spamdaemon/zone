describe("zone for unit testing", function() {
    "use strict";

    // the inject function uses late-binding to the current in-scope zone object.
    var inject = function() {
        var args = arguments;
        return function() {
            return zone.inject.apply(null, args)();
        };
    };

    beforeEach(function() {
        zone = zone.makeZone();
        zone("mine").value("foo", "bar");
    });

    it("should support injection when unit testing", inject("mine", [ "foo" ], function(foo) {
        expect(foo).toBe("bar");
    }));

    it("should ensure that the interceptor example works", function() {
        var module = zone("greeting");
        module.value("phrase", "Hello, World!");

        module.interceptor("phrase", [ 'language', function(lang) {
            return function(v) {
                // if the language is German, return a specific greeting
                if (lang === 'de') {
                    return "Hallo, Welt!";
                }
                // return the default greeting
                return v();
            };
        } ]);

        module.value("language", 'de');

        expect(zone.get('greeting.phrase')).toBe("Hallo, Welt!");
    });

    it("should ensure that the inject example works (1)", function() {
        zone("child").value("foo", 1);
        zone("child").value("bar", 2);
        var g = function(a, b, x, y) {
            return [ a, b, x, y ];
        };
        var fn = zone("child").inject([ 'foo', 'bar', '#x', '#y', g ]);
        var z = fn(3, 4);

        expect(z).toEqual([ 1, 2, 3, 4 ]);
    });

    it("should pass the name of the intercepted obejct on to the interception function", function() {
        zone("myzone").value("foo", "bar");
        var interceptedModule;
        var interceptedLocal;
        var interceptedValue;

        zone().interceptor(function() {
            return true;
        }, function() {
            return function(v, m, l) {
                interceptedModule = m;
                interceptedLocal = l;
                interceptedValue = v();
                return v() + 'intercepted';
            };
        });
        expect(zone("myzone").get("foo")).toBe("barintercepted");
        expect(interceptedModule).toBe("myzone");
        expect(interceptedLocal).toBe("foo");
        expect(interceptedValue).toBe("bar");
    });

    it("should make sure that the example for exporting public names works", function() {
        var z = zone.makeZone();
        z("a.b.c").value('foo', 'bar');
        var names = z.names(/foo$/);
        expect(names[0]).toBe('a.b.c.foo');
    });
});
