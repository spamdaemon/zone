/**
 * The simple tests that really just verify the individially defined objects.
 */
describe("modules", function() {
    "use strict";

    it("should define the Array", function() {
        expect(SavedZone.get("$Array")).toBe(Array);
        expect(SavedZone.get("$Array")).toBe(window.Array);
    });

    it("should define the console", function() {
        expect(SavedZone.get("$console")).toBe(window.console);
    });

    it("should define the document", function() {
        expect(SavedZone.get("$document")).toBe(window.document);
    });

    it("should define the indexeddb", function() {
        expect(SavedZone.get("$indexedDB")).toBe(window.indexedDB);
    });

    it("should define the Math", function() {
        expect(SavedZone.get("$Math")).toBe(Math);
        expect(SavedZone.get("$Math")).toBe(window.Math);
    });

    it("should define the window", function() {
        expect(SavedZone.get("$window")).toBe(window);
    });

    it("should define the worker", function() {
        expect(SavedZone.get("$Worker")).toBe(window.Worker);
    });

    it("should define the XMLHttpRequest", function() {
        expect(SavedZone.get("$XMLHttpRequest")).toBe(window.XMLHttpRequest);
    });
});
