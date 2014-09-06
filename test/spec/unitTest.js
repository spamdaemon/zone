describe("zone for unit testing", function() {

    beforeEach(function() {
        zone.reset();
        zone("mine").export("foo", "bar");
    });

    it("should support injection when unit testing", zone.inject("mine", [ "foo" ], function(foo) {
        expect(foo).toBe("bar");
    }));

    it("should ensure that the interceptor example works", function() {
        var module = zone("greeting");
        module.exportValue("phrase", "Hello, World!");

        module.interceptor("phrase", [ 'language', function(lang) {
            return function(v) {
                // if the language is German, return a specific greeting
                if (lang === 'de') {
                    return "Hallo, Welt!";
                }
                // return the default greeting
                return v;
            };
        } ]);

        module.exportValue("language", 'de');

        expect(zone.get('greeting.phrase')).toBe("Hallo, Welt!");
    });

    it("should ensure that the inject example works (1)", function() {
        zone("child").exportValue("foo", 1);
        zone("child").exportValue("bar", 2);
        var g = function(a, b, x, y) {
            return [ a, b, x, y ]
        };
        var fn = zone("child").inject([ 'foo', 'bar', '#x', '#y', g ]);
        var z = fn(3, 4);

        expect(z).toEqual([ 1, 2, 3, 4 ]);
    });

});
