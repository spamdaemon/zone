describe("zone", function() {

    beforeEach(function() {
        zone.reset();
    });

    it("should have a root module", function() {
        var root = zone();
        expect(root).not.toBeNull();
    });

    it("it should create sub-modules", function() {
        var root = zone();
        var mine = root.create("mine");
        var yours = mine.create("yours");

        expect(yours).not.toBeNull();
    });

    it("it should find submodules by their name", function() {
        var root = zone();
        var mine = root.create("mine");
        var yours = mine.create("yours");
        expect(zone("mine")).toBe(mine);
        expect(zone("mine.yours")).toBe(yours);
    });

    it("it should allow definition of private objects", function() {
        var mine = zone().create("mine");
        var fn = function() {
            mine.definePrivate("foo", "bar");
        };
        expect(fn).not.toThrow();
    });

    it("it should allow definition of public objects", function() {
        var mine = zone().create("mine");
        mine.define("foo", "bar");

        expect(mine.get("foo")).toBe("bar");
    });

    it("it inject a function with a public value", function() {
        var mine = zone().create("mine");
        mine.define("foo", "bar");
        var fn = mine.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("it should seal a module once objects have been injected or retrieved", function() {
        zone().define("foo", "bar").get("foo");

        expect(function() {
            zone().define("bar", "zoo");
        }).toThrow();
        expect(function() {
            zone().definePrivate("bar1", "zoo");
        }).toThrow();
        expect(function() {
            zone().defineProtected("bar2", "zoo");
        }).toThrow();

    });

    it("it inject a function with a value from a parent module", function() {
        var mine = zone().create("mine");
        zone().define("foo", "bar");
        var fn = mine.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("it inject a function with a value from a included module", function() {
        var mine = zone().create("mine");
        var yours = zone().create("yours", [ "mine" ]);

        mine.define("foo", "bar");
        var fn = yours.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("it should inject a function with values in a specific order", function() {
        var root = zone();
        var mine = zone().create("mine");
        var yours = zone().create("yours", [ "mine" ]);

        root.defineProtected("bar", "root");
        root.defineProtected("foo", "root");
        mine.define("foo", "mine");
        mine.define("bar", "mine");
        yours.define("bar", "yours");
        root.define("baz", "root");

        // search locally first
        var fn, value;
        {
            fn = yours.inject([ "bar" ], function(foo) {
                return foo;
            });
            expect(fn).not.toBeNull();
            value = fn();
            expect(value).toBe("yours");
        }

        // search includes first
        {
            fn = yours.inject([ "foo" ], function(foo) {
                return foo;
            });
            expect(fn).not.toBeNull();
            value = fn();
            expect(value).toBe("mine");
        }

        // search parent last
        {
            fn = yours.inject([ "baz" ], function(foo) {
                return foo;
            });
            expect(fn).not.toBeNull();
            value = fn();
            expect(value).toBe("root");
        }
    });

    it("it should inject private variables", function() {
        var mine = zone().create("mine").definePrivate("foo", "foo").define("bar", [ "foo" ], function(foo) {
            return foo;
        });
        var value = mine.get("bar");
        expect(value).toBe("foo");

    });

    it("it should inject protected variables", function() {
        var mine = zone().create("mine").defineProtected("foo", "foo").define("bar", [ "foo" ], function(foo) {
            return foo;
        });
        var value = mine.get("bar");
        expect(value).toBe("foo");
    });

    it("it should inject  variables with absolute paths", function() {
        var mine = zone().create("mine").definePrivate("foo", "foo").define("bar", [ "yours.foo" ], function(foo) {
            return foo;
        });
        zone().create("yours").define("foo", "FOO");
        var value = mine.get("bar");
        expect(value).toBe("FOO");
    });

    it("it should detect cyclic module dependencies", function() {
        zone().create("mine", [ "yours" ]);
        var yours = zone().create("yours", [ "mine" ]);
        var fn = function() {
            return yours.get("X");
        };
        expect(fn).toThrow();
    });

    it("it should support references to self", function() {
        zone().create("mine", [ "mine" ]);
        var fn = function() {
            return mine.get("X");
        };
        expect(fn).toThrow();
    });

    it("it should detect cyclic module dependencies during injection", function() {
        var mine = zone().create("mine");
        mine.define("foo", [ "yours.bar" ], function(foo) {
            return "mine.foo";
        });
        var yours = zone().create("yours");
        yours.define("bar", [ "mine.foo" ], function(foo) {
            return "yours.bar";
        });
        var fn = function() {
            return yours.get("bar");
        };
        expect(fn).toThrow();
    });

    it("it should support optional parameters", function() {
        zone().define("foo", [ "?x.bar" ], function(x) {
            return "foo";
        });

        expect(zone().get("foo")).toBe("foo");
    });

    it("it automatically create dependencies from function parameters", function() {
        zone().define("foo", function(baz) {
            return "foo" + baz;
        }).define("baz", "bar");

        expect(zone().get("foo")).toBe("foobar");
    });

    it("it should properly deal with functions that throw", function() {
        zone().define("foo", function(baz) {
            var x = [];
            x[1].foo();
        }).define("baz", "bar");
        var fn = function() {
            return zone().get("foo");
        };
        expect(fn).toThrow();
    });

    it("it implicitly create a module that does not already exist", function() {
        zone("x.y.z");
        expect(zone("x.y", true)).not.toBeNull();
    });

    it("it should not implicitly create a module", function() {
        var fn = function() {
            zone("x.y.z", true);
        };
        expect(fn).toThrow();
    });

    it("it should not implicitly create a module during injection", function() {

        var fn = zone().inject([ "?x.y.z.bar" ], function(x) {
            return x ? "Y" : "N";
        });

        expect(fn()).toBe("N");

        fn = function() {
            zone("x.y.z", true);
        };
        expect(fn).toThrow();
    });

    it("allow repeated calls to create with the same name", function() {
        var m = zone().create("foo");
        var n = zone().create("foo");
        expect(m).toBe(n);
    });

    it("allow repeated calls to create with the same name as long as imports are not overridden", function() {
        var m = zone().create("foo", []);
        var n = zone().create("foo");
        expect(m).toBe(n);
    });

    it("allow repeated calls to create with the same name, but only set imports on last call", function() {
        zone().create("foo");
        var fn = function() {
            zone().create("foo", []);
        };
        expect(fn).not.toThrow();
    });

    it("should not allow repeated calls to create with the same name once imports have been set", function() {
        zone().create("foo", []);

        var fn = function() {
            zone().create("foo", []);
        };
        expect(fn).toThrow();
    });

    it("should not allow repeated calls to create with the same name once imports have been set via object resolution", function() {
        zone().define("foo", "bar");
        var foozone = zone().create("foo", null);

        // the lookup for foo w
        expect(foozone.get("foo")).toBe("bar");
        var fn = function() {
            zone().create("foo", []);
        };
        expect(fn).toThrow();
    });

    it("should bind 'this' to the module in which the object is found", function() {
        var m = zone("mine");
        m.define("foo", function() {
            return this;
        });
        var v = m.create("child").get("foo");
        expect(v).toBe(m);
    });

    it("should bind 'this' to the module in which the object is found", function() {
        var m = zone("mine");
        var c = m.create("child");
        m.define("foo", {});

        var fn = function(foo) {
            return this;
        };
        var v = c.inject(fn)();

        expect(v).toBe(c);
    });

    it("should create a function descriptor", function() {
        var d1 = zone.asFunction(function(foo) {
            return this;
        });
        var d2 = zone.asFunction([ "foo" ], function(bar) {
            return this;
        });

        zone().define("foo", {});

        var v = zone().inject(d1)();
        expect(v).toBe(zone());
        v = zone().inject(d2)();
        expect(v).toBe(zone());
    });

    it("should support function descriptors for define* functions", function() {

        zone().define("foo", zone.asFunction(function() {
            return "foo";
        }));
        zone().defineProtected("bar", zone.asFunction(function() {
            return "bar";
        }));
        zone().definePrivate("baz", zone.asFunction(function() {
            return "baz";
        }));

        zone().define("x", function(foo, bar, baz) {
            return foo + bar + baz;
        });

        expect(zone().get("x")).toBe("foobarbaz");
    });

    it("should implement static injection", function() {
        zone("mine").define("foo", "bar");

        var fn = zone.inject("mine", [ "foo" ], function(x) {
            return x;
        });

        expect(fn()).toBe("bar");
    });

    it("should implement static injection into the root module", function() {
        zone().define("foo", "bar");

        var fn = zone.inject([ "foo" ], function(x) {
            return x;
        });

        expect(fn()).toBe("bar");

    });

    it("should not implement static injection if the base module cannot be found", function() {

        var fn = zone.inject("mine", function(foo) {
            return foo;
        });

        expect(fn).toThrow();
    });

    it("should created injected functions that can take arguments", function() {
        zone("mine").define("foo", "foo");
        var fn = zone.inject("mine", [ "foo", "#y", "#z" ], function(x, y, z) {
            return x + y + z;
        });

        expect(fn("bar", "baz")).toBe("foobarbaz");
    });

    it("should created injected functions that can take arguments", function() {
        zone("mine").define("foo", "foo");
        var fn = zone("mine").inject([ "foo", "#y", "#z" ], function(x, y, z) {
            return x + y + z;
        });

        expect(fn("bar", "baz")).toBe("foobarbaz");
    });

    it("should define objects using a constructor function", function() {
        zone().define("foo", "bar");
        zone().define("service", zone.asConstructor(function(foo) {

            this.get = function() {
                return foo;
            };
        }));
        var srv = zone().get("service");
        expect(srv.get()).toBe("bar");
    });

    it("should define services", function() {
        zone().define("foo", "bar");
        zone().service("service", function(foo) {

            this.get = function() {
                return foo;
            };
        });
        var srv = zone().get("service");
        expect(srv.get()).toBe("bar");
    });

    it("should define factory functions", function() {
        zone().define("foo", "bar");
        zone().factory("factory", function(foo) {

            return "foo" + foo;
        });
        expect(zone().get("factory")).toBe("foobar");
    });

    it("should support angular's version of function definition", function() {
        zone().define("foo", "bar");
        zone().define("service", zone.asFunction([ "foo", function(foo) {
            return foo;
        } ]));

        expect(zone().get("service")).toBe("bar");

    });

    it("should support angular's version of function definition", function() {
        zone().value("foo", "bar");
        expect(zone().get("foo")).toBe("bar");
    });

    it("should support angular's version of function definition", function() {
        zone().value("foo", zone.asValue("bar"));
        expect(zone().get("foo")).toBe("bar");
    });

    it("should allow a module and defintion by the same name in the same module", function() {
        zone().value("foo", "bar");
        var M = zone().create("foo");
        expect(zone("foo")).toBe(M);
        expect(zone.get("foo")).toBe("bar");
    });
});
