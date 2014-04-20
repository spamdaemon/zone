describe("tests that reproduce bugs", function() {

    beforeEach(function() {
        zone.reset();
    });

    it("should not detect a cyclic dependency when looking up optional value through a sibling", function() {

        zone().create("sibling");
        zone().create("myzone", [ "sibling" ]);

        var fn = function() {
            var b = zone.inject([ "?myzone.value" ], function(value) {
            });
            b();
        };
        expect(fn).not.toThrow();
    });

    it("should not detect a cyclic dependency when looking up an object that doesn't exist", function() {

        zone().create("sibling");
        zone().create("myzone", [ "sibling" ]);

        var fn = function() {
            var b = zone.inject([ "myzone.value" ], function(value) {
            });
            try {
                b();
            } catch (error) {
                if (error.message.indexOf("Cyclic") >= 0) {
                    // not expected a cyclic dependency
                    throw error;
                }
            }
        };
        expect(fn).not.toThrow();
    });

});
