/**
 * The simple tests that really just verify the individially defined objects.
 */
describe("modules", function() {
    "use strict"

    it("should define the window", function() {
        expect(BaseZone.get("$window")).toBe(window);
    });

    it("should define the indexeddb", function() {
        expect(BaseZone.get("$indexedDB")).toBe(window.indexedDB);
    });
    it("should define the console", function() {
        expect(BaseZone.get("$console")).toBe(window.console);
    });

    it("should define the document", function() {
        expect(BaseZone.get("$document")).toBe(window.document);
    });

    it("should define the worker", function() {
        expect(BaseZone.get("$Worker")).toBe(window.Worker);
    });

    it("should define the XMLHttpRequest", function() {
        expect(BaseZone.get("$XMLHttpRequest")).toBe(window.XMLHttpRequest);
    });
});
