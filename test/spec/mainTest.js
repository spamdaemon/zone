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
        mine.export("foo", "bar");

        expect(mine.get("foo")).toBe("bar");
    });

    it("it inject a function with a public value", function() {
        var mine = zone().create("mine");
        mine.export("foo", "bar");
        var fn = mine.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("it should seal a module once objects have been injected or retrieved", function() {
        zone().export("foo", "bar").get("foo");

        expect(function() {
            zone().export("bar", "zoo");
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
        zone().export("foo", "bar");
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

        mine.export("foo", "bar");
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
        mine.export("foo", "mine");
        mine.export("bar", "mine");
        yours.export("bar", "yours");
        root.export("baz", "root");

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
        var mine = zone().create("mine").definePrivate("foo", "foo").export("bar", [ "foo" ], function(foo) {
            return foo;
        });
        var value = mine.get("bar");
        expect(value).toBe("foo");

    });

    it("it should inject protected variables", function() {
        var mine = zone().create("mine").defineProtected("foo", "foo").export("bar", [ "foo" ], function(foo) {
            return foo;
        });
        var value = mine.get("bar");
        expect(value).toBe("foo");
    });

    it("it should inject  variables with absolute paths", function() {
        var mine = zone().create("mine").definePrivate("foo", "foo").export("bar", [ "yours.foo" ], function(foo) {
            return foo;
        });
        zone().create("yours").export("foo", "FOO");
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
        mine.export("foo", [ "yours.bar" ], function(foo) {
            return "mine.foo";
        });
        var yours = zone().create("yours");
        yours.export("bar", [ "mine.foo" ], function(foo) {
            return "yours.bar";
        });
        var fn = function() {
            return yours.get("bar");
        };
        expect(fn).toThrow();
    });

    it("it should support optional parameters", function() {
        zone().export("foo", [ "?x.bar" ], function(x) {
            return "foo";
        });

        expect(zone().get("foo")).toBe("foo");
    });

    it("it automatically create dependencies from function parameters", function() {
        zone().export("foo", function(baz) {
            return "foo" + baz;
        }).export("baz", "bar");

        expect(zone().get("foo")).toBe("foobar");
    });

    it("it should properly deal with functions that throw", function() {
        zone().export("foo", function(baz) {
            var x = [];
            x[1].foo();
        }).export("baz", "bar");
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
        zone().export("foo", "bar");
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
        m.export("foo", function() {
            return this;
        });
        var v = m.create("child").get("foo");
        expect(v).toBe(m);
    });

    it("should bind 'this' to the module in which the object is found", function() {
        var m = zone("mine");
        var c = m.create("child");
        m.export("foo", {});

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

        zone().export("foo", {});

        var v = zone().inject(d1)();
        expect(v).toBe(zone());
        v = zone().inject(d2)();
        expect(v).toBe(zone());
    });

    it("should support function descriptors for define* functions", function() {

        zone().export("foo", zone.asFunction(function() {
            return "foo";
        }));
        zone().defineProtected("bar", zone.asFunction(function() {
            return "bar";
        }));
        zone().definePrivate("baz", zone.asFunction(function() {
            return "baz";
        }));

        zone().export("x", function(foo, bar, baz) {
            return foo + bar + baz;
        });

        expect(zone().get("x")).toBe("foobarbaz");
    });

    it("should implement static injection", function() {
        zone("mine").export("foo", "bar");

        var fn = zone.inject("mine", [ "foo" ], function(x) {
            return x;
        });

        expect(fn()).toBe("bar");
    });

    it("should implement static injection into the root module", function() {
        zone().export("foo", "bar");

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
        zone("mine").export("foo", "foo");
        var fn = zone.inject("mine", [ "foo", "#y", "#z" ], function(x, y, z) {
            return x + y + z;
        });

        expect(fn("bar", "baz")).toBe("foobarbaz");
    });

    it("should created injected functions that can take arguments", function() {
        zone("mine").export("foo", "foo");
        var fn = zone("mine").inject([ "foo", "#y", "#z" ], function(x, y, z) {
            return x + y + z;
        });

        expect(fn("bar", "baz")).toBe("foobarbaz");
    });

    it("should define objects using a constructor function", function() {
        zone().export("foo", "bar");
        zone().export("service", zone.asConstructor(function(foo) {

            this.get = function() {
                return foo;
            };
        }));
        var srv = zone().get("service");
        expect(srv.get()).toBe("bar");
    });

    it("should export public services", function() {
        zone().export("foo", "bar");
        zone().exportService("service", function(foo) {

            this.get = function() {
                return foo;
            };
        });
        var srv = zone().get("service");
        expect(srv.get()).toBe("bar");
    });

    it("should export public factory functions", function() {
        zone().export("foo", "bar");
        zone().exportFactory("factory", function(foo) {

            return "foo" + foo;
        });
        expect(zone().get("factory")).toBe("foobar");
    });

    it("should define private services", function() {
        zone().export("foo", "bar");
        zone().service("service", function(foo) {

            this.get = function() {
                return foo;
            };
        });
        zone().exportFactory("x", function(service) {
            return service.get();
        });

        expect(function() {
            zone().get("service");
        }).toThrow();

        expect(zone().get("x")).toBe("bar");
    });

    it("should define private factory functions", function() {
        zone().export("foo", "bar");
        zone().factory("factory", function(foo) {

            return "foo" + foo;
        });
        zone().exportFactory("x", function(factory) {
            return factory;
        });

        expect(function() {
            zone().get("factory");
        }).toThrow();

        expect(zone().get("x")).toBe("foobar");
    });

    it("should support angular's version of function definition", function() {
        zone().export("foo", "bar");
        zone().export("service", zone.asFunction([ "foo", function(foo) {
            return foo;
        } ]));

        expect(zone().get("service")).toBe("bar");

    });

    it("should support angular's version of function definition", function() {
        zone().exportValue("foo", "bar");
        expect(zone().get("foo")).toBe("bar");
    });

    it("should support angular's version of function definition", function() {
        zone().exportValue("foo", zone.asValue("bar"));
        expect(zone().get("foo")).toBe("bar");
    });

    it("should allow a module and defintion by the same name in the same module", function() {
        zone().exportValue("foo", "bar");
        var M = zone().create("foo");
        expect(zone("foo")).toBe(M);
        expect(zone.get("foo")).toBe("bar");
    });

    it("should be able to intercept values", function() {
        zone("myzone").exportValue("foo", "foo");
        zone("myzone").interceptor("foo", function() {
            return function(x) {
                return "bar";
            };
        });
        expect(zone("myzone").get("foo")).toBe("bar");
    });

    it("should be able to intercept service or factory objects", function() {
        zone("myzone").value("BAR", "bar");
        zone("myzone").exportFactory("foo", function() {
            return "foo";
        });
        zone("myzone").interceptor("foo", [ "BAR" ], function(xbar) {
            return function(x) {
                return xbar;
            };
        });
        expect(zone("myzone").get("foo")).toBe("bar");
    });

    it("interceptors must not refer to the object being intercepted", function() {
        zone("myzone").factory("BAR", [ "foo" ], function(foo) {
            return "HAHA";
        });
        zone("myzone").exportFactory("foo", function() {
            return "foo";
        });

        zone("myzone").interceptor("foo", [ "BAR" ], function(xbar) {
            return function(x) {
                return xbar;
            };
        });

        var fn = function() {
            zone("myzone").get("foo");
        };
        expect(fn).toThrow();
    });

    it("should use the correct module for resolving interceptor dependencies", function() {
        zone("base.extension").interceptor("base.service", [ "greeting" ], function(greeting) {
            return function(s) {
                s.say = greeting;
                return s;
            };
        }).value("greeting", "hallo");

        zone("base").protectedService("service", function() {
            this.say = "hello";
        }).exportService("greeter", [ "service" ], function(service) {
            this.greet = service.say;
        });

        expect(zone("base").get("greeter").greet).toBe("hallo");
    });

    it("should support verify long function declarations", function() {

        zone("object").service(
                "service",
                function(a1234567890, b1234567890, c1234567890, d1234567890, e1234567890, f1234567890, g1234567890, h1234567890, i1234567890, j1234567890,
                        k1234567890, l1234567890, m1234567890, n1234567890, o1234567890, p1234567890, q1234567890) {

                });
    });

    it("should throw an exception if injection fails", function() {
        zone().exportService("xxxbar", [ "baz" ], function(baz) {
        });
        var fn = zone.inject([ "xxxbar" ], function(bar) {
        });
        expect(fn).toThrow();
    });

    it("should be able to inject a protected object", function() {
        zone("base").protectedValue("foo", "foo");
        zone("base.ext").exportFactory("bar", [ "base.foo" ], function(foo) {
            return foo;
        });

        expect(zone.get("base.ext.bar")).toBe("foo");

    });

    it("should be not be able to access a proteced object", function() {
        zone("base").protectedValue("foo", "foo");

        var fn = function() {
            zone.get("base.ext.foo");
        };
        expect(fn).toThrow();
    });

});
