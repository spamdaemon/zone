describe("zone for unit testing", function() {


    beforeEach(function() {
        zone.reset();
        zone("mine").export("foo", "bar");
    });

    it("should support injection when unit testing", zone.inject("mine",["foo"], function(foo) {
        expect(foo).toBe("bar");
    }));
});
