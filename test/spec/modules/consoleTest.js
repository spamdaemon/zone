/**
 * 
 */
describe("console", function() {
    "use strict";

    it("it should define a global console", function() {
        var fn = SavedZone.inject([ '$console' ], function(con) {
            con.log("Hello, World!");
            return con;
        });

        expect(fn).not.toThrow();
    });
});
