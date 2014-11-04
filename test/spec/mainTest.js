describe("zone", function() {
    "use strict";

    beforeEach(function() {
        zone = zone.makeZone();
    });

    it("should have a root module", function() {
        var root = zone();
        expect(root).not.toBeNull();
    });

    it("should not be able to configure the root module", function() {
        var fn = function() {
            zone().configure([]);
        };
        expect(fn).toThrow();
    });

    it("should create sub-modules", function() {
        var root = zone();
        var mine = root.create("mine");
        var yours = mine.create("yours");

        expect(yours).not.toBeNull();
    });

    it("should find submodules by their name", function() {
        var root = zone();
        var mine = root.create("mine");
        var yours = mine.create("yours");
        expect(zone("mine")).toBe(mine);
        expect(zone("mine.yours")).toBe(yours);
    });

    it("should allow definition of private objects", function() {
        var mine = zone().create("mine");
        var fn = function() {
            mine.value("-foo", "bar");
        };
        expect(fn).not.toThrow();
    });

    it("should allow definition of public objects", function() {
        var mine = zone().create("mine");
        mine.value("foo", "bar");

        expect(mine.get("foo")).toBe("bar");
    });

    it("inject a function with a public value", function() {
        var mine = zone().create("mine");
        mine.value("foo", "bar");
        var fn = mine.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("should seal a module once objects have been injected or retrieved", function() {
        zone().value("foo", "bar").get("foo");

        expect(function() {
            zone().value("bar", "zoo");
        }).toThrow();
        expect(function() {
            zone().value("-bar1", "zoo");
        }).toThrow();
        expect(function() {
            zone().value("#bar2", "zoo");
        }).toThrow();

    });

    it("inject a function with a value from a parent module", function() {
        var mine = zone().create("mine");
        zone().value("foo", "bar");
        var fn = mine.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("inject a function with a value from a included module", function() {
        var mine = zone().create("mine");
        var yours = zone().create("yours").configure([ "mine" ]);

        mine.value("foo", "bar");
        var fn = yours.inject([ "foo" ], function(foo) {
            return foo;
        });
        expect(fn).not.toBeNull();
        var value = fn();
        expect(value).toBe("bar");
    });

    it("must not configure a module after its been used for access", function() {
        var mine = zone().create("mine");
        mine.value("foo", "foo");
        mine.get("foo");

        var fn = function() {
            mine.configure([]);
        };
        expect(fn).toThrow();
    });

    it("should inject a function with values in a specific order", function() {
        var root = zone();
        var mine = zone().create("mine");
        var yours = zone().create("yours").configure([ "mine" ]);

        root.value("#bar", "root");
        root.value("#foo", "root");
        mine.value("foo", "mine");
        mine.value("bar", "mine");
        yours.value("bar", "yours");
        root.value("baz", "root");

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

    it("should inject private variables", function() {
        var mine = zone().create("mine").value("-foo", "foo").factory("bar", [ "foo" ], function(foo) {
            return foo;
        });
        var value = mine.get("bar");
        expect(value).toBe("foo");

    });

    it("should inject protected variables", function() {
        var mine = zone().create("mine").value("#foo", "foo").factory("bar", [ "foo" ], function(foo) {
            return foo;
        });
        var value = mine.get("bar");
        expect(value).toBe("foo");
    });

    it("should inject  variables with absolute paths", function() {
        var mine = zone().create("mine").value("-foo", "foo").factory("bar", [ "yours.foo" ], function(foo) {
            return foo;
        });
        zone().create("yours").value("foo", "FOO");
        var value = mine.get("bar");
        expect(value).toBe("FOO");
    });

    it("should detect cyclic module dependencies", function() {
        zone().create("mine").configure([ "yours" ]);
        var yours = zone().create("yours").configure([ "mine" ]);
        var fn = function() {
            return yours.get("X");
        };
        expect(fn).toThrow();
    });

    it("should support references to self", function() {
        zone().create("mine").configure([ "mine" ]);
        var fn = function() {
            return mine.get("X");
        };
        expect(fn).toThrow();
    });

    it("should detect cyclic module dependencies during injection", function() {
        var mine = zone().create("mine");
        mine.factory("foo", [ "yours.bar" ], function(foo) {
            return "mine.foo";
        });
        var yours = zone().create("yours");
        yours.factory("bar", [ "mine.foo" ], function(foo) {
            return "yours.bar";
        });
        var fn = function() {
            return yours.get("bar");
        };
        expect(fn).toThrow();
    });

    it("should support optional parameters", function() {
        zone().factory("foo", [ "?x.bar" ], function(x) {
            return "foo";
        });

        expect(zone().get("foo")).toBe("foo");
    });

    it("should not support the '#' parameters for factories/constructors", function() {

        var fn = function() {
            zone().factory("foo", [ "#x.bar" ], function(x) {
                return "foo";
            });
        };
        expect(fn).toThrow();
    });

    it("should support optional parameters", function() {
        zone().factory("foo", [ "?x.bar" ], function(x) {
            return x;
        });

        expect(zone().get("foo")).toBeUndefined();
    });

    it("automatically create dependencies from function parameters", function() {
        zone().factory("foo", function(baz) {
            return "foo" + baz;
        }).value("baz", "bar");

        expect(zone().get("foo")).toBe("foobar");
    });

    it("should properly deal with functions that throw", function() {
        zone().factory("foo", function(baz) {
            var x = [];
            x[1].foo();
        }).value("baz", "bar");
        var fn = function() {
            return zone().get("foo");
        };
        expect(fn).toThrow();
    });

    it("implicitly create a module that does not already exist", function() {
        zone("x.y.z");
        expect(zone("x.y", true)).not.toBeNull();
    });

    it("should not implicitly create a module", function() {
        var fn = function() {
            zone("x.y.z", true);
        };
        expect(fn).toThrow();
    });

    it("should not implicitly create a module during injection", function() {

        var fn = zone().inject([ "?x.y.z.bar" ], function(x) {
            return x ? "Y" : "N";
        });

        expect(fn()).toBe("N");

        fn = function() {
            zone("x.y.z", true);
        };
        expect(fn).toThrow();
    });

    it("should reject invalid paramter names", function() {

        var fn = function() {
            zone().inject([ "?#bar" ], function(x) {
                return x ? "Y" : "N";
            });
        };
        expect(fn).toThrow();
    });

    it("allow repeated calls to create with the same name", function() {
        var m = zone().create("foo");
        var n = zone().create("foo");
        expect(m).toBe(n);
    });

    it("allow repeated calls to create with the same name as long as imports are not overridden", function() {
        var m = zone().create("foo").configure([]);
        var n = zone().create("foo");
        expect(m).toBe(n);
    });

    it("allow repeated calls to create with the same name, but only set imports on last call", function() {
        zone().create("foo");
        var fn = function() {
            zone().create("foo").configure([]);
        };
        expect(fn).not.toThrow();
    });

    it("should not allow repeated calls to create with the same name once imports have been set", function() {
        zone().create("foo").configure([]);

        var fn = function() {
            zone().create("foo").configure([]);
        };
        expect(fn).toThrow();
    });

    it("should not allow repeated calls to create with the same name once imports have been set via object resolution", function() {
        zone().value("foo", "bar");
        var foozone = zone().create("foo");

        // the lookup for foo w
        expect(foozone.get("foo")).toBe("bar");
        var fn = function() {
            zone().create("foo").configure([]);
        };
        expect(fn).toThrow();
    });

    it("should should find direct imports", function() {
        zone("a").value("foo", "bar");
        zone("b").configure([ 'a' ]);

        expect(zone.get("b.foo")).toBe('bar');
    });

    it("should use only direct imports (no recursion)", function() {
        zone("a").value("foo", "bar");
        zone("b").configure([ 'a' ]);
        zone("c").configure([ 'b' ]);

        zone.get("b.foo");

        var fn = function() {
            zone.get("c.foo");
        };
        expect(fn).toThrow();
    });

    it("should use only direct imports (no recursion)", function() {
        zone("right").value("foo", "bar");
        zone("left").configure([ 'right.rightChild' ]);
        zone("right.rightChild");
        var fn = function() {
            zone.get("left.foo");
        };
        expect(fn).toThrow();
    });

    it("should bind 'this' to the null in factory functions", function() {
        var m = zone("mine");
        m.factory("foo", function() {
            return this;
        });
        var v = m.create("child").get("foo");
        expect(v).toBe(null);
    });

    it("should bind 'this' to the service ", function() {
        var m = zone("mine");
        var THIS = null;

        m.service("foo", function() {
            THIS = this;
            this.get = function() {
                return this;
            };
        });

        var srv = m.get("foo");
        expect(THIS).toBe(srv);
        expect(THIS).toBe(srv.get());
    });

    it("should bind 'this' to the in-scope 'this' pointer", function() {
        var m = zone("mine");
        var c = m.create("child");
        m.value("foo", {});

        var fn = function(foo) {
            return this;
        };
        var THIS = {};
        var v = c.inject(fn).apply(THIS);

        expect(v).toBe(THIS);
    });

    it("should create a function descriptor", function() {
        var d1 = zone.asFunction(function(foo) {
            return this;
        });
        var d2 = zone.asFunction([ "foo" ], function(bar) {
            return this;
        });
        var THIS = {};

        zone().value("foo", {});

        var v = zone().inject(d1).apply(THIS);
        expect(v).toBe(THIS);
        v = zone().inject(d2).apply(THIS);
        expect(v).toBe(THIS);
    });

    it("should support function descriptors for define* functions", function() {

        zone().factory("+foo", zone.asFunction(function() {
            return "foo";
        }));
        zone().factory("#bar", zone.asFunction(function() {
            return "bar";
        }));
        zone().factory("-baz", zone.asFunction(function() {
            return "baz";
        }));

        zone().factory("x", function(foo, bar, baz) {
            return foo + bar + baz;
        });

        expect(zone().get("x")).toBe("foobarbaz");
    });

    it("should implement static injection", function() {
        zone("mine").value("foo", "bar");

        var fn = zone.inject("mine", [ "foo" ], function(x) {
            return x;
        });

        expect(fn()).toBe("bar");
    });

    it("should implement static injection with bound this pointer", function() {
        zone("mine").value("foo", "World!");

        var THIS = "Hello, ";

        var fn = zone.inject("mine", [ "foo" ], function(x) {
            return this + x;
        });

        var result = fn.apply(THIS, []);

        expect(result).toBe("Hello, World!");
    });

    it("should implement static injection into the root module", function() {
        zone().value("foo", "bar");

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
        zone("mine").value("foo", "foo");
        var fn = zone.inject("mine", [ "foo", "#y", "#z" ], function(x, y, z) {
            return x + y + z;
        });

        expect(fn("bar", "baz")).toBe("foobarbaz");
    });

    it("should created injected functions that can take arguments", function() {
        zone("mine").value("foo", "foo");
        var fn = zone("mine").inject([ "foo", "#y", "#z" ], function(x, y, z) {
            return x + y + z;
        });

        expect(fn("bar", "baz")).toBe("foobarbaz");
    });

    it("should define objects using a constructor function", function() {
        zone().value("foo", "bar");
        zone().service("service", zone.asConstructor(function(foo) {

            this.get = function() {
                return foo;
            };
        }));
        var srv = zone().get("service");
        expect(srv.get()).toBe("bar");
    });

    it("should export public services", function() {
        zone().value("foo", "bar");
        zone().service("service", function(foo) {

            this.get = function() {
                return foo;
            };
        });
        var srv = zone().get("service");
        expect(srv.get()).toBe("bar");
    });

    it("should export public factory functions", function() {
        zone().value("foo", "bar");
        zone().factory("factory", function(foo) {

            return "foo" + foo;
        });
        expect(zone().get("factory")).toBe("foobar");
    });

    it("should define private services", function() {
        zone().value("foo", "bar");
        zone().service("-service", function(foo) {

            this.get = function() {
                return foo;
            };
        });
        zone().factory("x", function(service) {
            return service.get();
        });

        expect(function() {
            zone().get("service");
        }).toThrow();

        expect(zone().get("x")).toBe("bar");
    });

    it("should define private factory functions", function() {
        zone().value("foo", "bar");
        zone().factory("-factory", function(foo) {

            return "foo" + foo;
        });
        zone().factory("x", function(factory) {
            return factory;
        });

        expect(function() {
            zone().get("factory");
        }).toThrow();

        expect(zone().get("x")).toBe("foobar");
    });

    it("should support angular's version of function definition", function() {
        zone().value("foo", "bar");
        zone().factory("service", zone.asFunction([ "foo", function(foo) {
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

    it("should be able to intercept values", function() {
        zone("myzone").value("foo", "foo");
        zone("myzone").interceptor("foo", function() {
            return function(x) {
                return "bar";
            };
        });
        expect(zone("myzone").get("foo")).toBe("bar");
    });

    it("should be able to intercept service or factory objects", function() {
        zone("myzone").value("-BAR", "bar");
        zone("myzone").factory("foo", function() {
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
        zone("myzone").factory("-BAR", [ "foo" ], function(foo) {
            return "HAHA";
        });
        zone("myzone").factory("foo", function() {
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
        }).value("-greeting", "hallo");

        zone("base").service("#service", function() {
            this.say = "hello";
        }).service("greeter", [ "service" ], function(service) {
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
        zone().service("xxxbar", [ "baz" ], function(baz) {
        });
        var fn = zone.inject([ "xxxbar" ], function(bar) {
        });
        expect(fn).toThrow();
    });

    it("should be able to inject a protected object", function() {
        zone("base").value("#foo", "foo");
        zone("base.ext").factory("bar", [ "base.foo" ], function(foo) {
            return foo;
        });

        expect(zone.get("base.ext.bar")).toBe("foo");

    });

    it("should be not be able to access a proteced object", function() {
        zone("base").value("#foo", "foo");

        var fn = function() {
            zone.get("base.ext.foo");
        };
        expect(fn).toThrow();
    });

    it("should support protected factories", function() {

        zone("base").factory("#foo", function() {
            return "FOO";
        });

        zone("base.derived").factory("bar", [ "foo" ], function(fooFactory) {
            return fooFactory;
        });

        expect(zone("base.derived").get("bar")).toBe("FOO");

    });

    it("should support null values and constants", function() {
        var base = zone("base").constant("foo", null).value('bar', null);
        expect(base.get('foo')).toBeNull();
        expect(base.get('bar')).toBeNull();
    });

    it("should support constants", function() {
        var base = zone("base").constant("foo", {});
        var value = base.get("foo");
        expect(Object.isFrozen(value)).toBe(true);
        expect(Object.isSealed(value)).toBe(true);
    });

    it("should support explicit public access for constants", function() {
        var base = zone("base").constant("+foo", 'HELLO');
        expect(base.get('foo')).toBe('HELLO');
    });

    it("should support explicit protected access for constants", function() {
        var base = zone("base").constant("#foo", 'HELLO');
        var child = zone("base.child").factory('bar', [ 'foo', function(f) {
            return f;
        } ]);
        expect(child.get('bar')).toBe('HELLO');
    });

    it("should support explicit private access for constants", function() {
        var base = zone("base").constant("-foo", 'HELLO').factory('baz', [ 'foo', function(f) {
            return f;
        } ]);

        expect(base.get('baz')).toBe('HELLO');
    });

    it("should be able to intercept values from anywhere using a generic function", function() {
        zone("myzone").value("foo", "foo");
        zone("myzone").value("bar", "bar");
        zone().interceptor(function(m, l) {
            console.log("Intercepting " + m + "  " + l);
            return true;
        }, function() {
            return function(x) {
                return x + "intercepted";
            };
        });
        expect(zone("myzone").get("foo")).toBe("foointercepted");
        expect(zone("myzone").get("bar")).toBe("barintercepted");
    });

    it("should make a new and pristine zone", function() {
        zone().value("foo", "bar");
        var zone2 = zone.makeZone();
        var fn = function() {
            return zone2.get("foo");
        };

        expect(fn).toThrow();
    });

    it("Make a simple recursive copy of the zone", function() {
        zone("a.b.c").value("foo", "bar");
        var zone2 = zone.copyZone();
        expect(zone2.get("a.b.c.foo")).toBe('bar');
    });

    it("Make a simple recursive copy of the zone and test interceptors", function() {
        zone("a.b.c").value("foo", "bar");
        var cnt = 0;
        // use side-effect in the interceptor to verify that we properly re-apply them
        // when copying a zone
        zone("a.b.c").interceptor("foo", function() {
            return function() {
                return cnt++;
            };
        });
        expect(zone.get("a.b.c.foo")).toBe(0);
        expect(zone.get("a.b.c.foo")).toBe(0);

        var zone2 = zone.copyZone();
        expect(zone2.get("a.b.c.foo")).toBe(1);
        expect(zone2.get("a.b.c.foo")).toBe(1);
    });

    it("should be able to delay binding for injections until invocation", function() {
        var fn = zone.inject([ 'foo', function(x) {
            return x;
        } ]);
        zone().value("foo", "bar");
        expect(fn()).toBe('bar');
    });

    it("should be able to bind an object its fullname", function() {
        zone.factory("+org.example.factory", function() {
            return 'Factory';
        });
        zone.service("+org.example.service", function() {
            this.get = 'Service';
        });
        zone.value("+org.example.value", 'Value');
        zone.constant("+org.example.constant", 'Constant');

        expect(zone.get("org.example.factory")).toBe('Factory');
        expect(zone.get("org.example.service").get).toBe('Service');
        expect(zone.get("org.example.value")).toBe('Value');
        expect(zone.get("org.example.constant")).toBe('Constant');
    });

    it("should enumerate the names", function() {
        zone("a.b.c").value("foo", 'bar');
        zone("x.y.z").value("foo", 'bar');
        zone("a.b").value("-foo", 'bar');

        var names = zone.names();
        expect(names.length).toBe(3);
        expect(names).toContain('a.b.c.foo');
        expect(names).toContain('x.y.z.foo');
    });

    it("should enumerate the names with a regexp filter", function() {
        zone("a.b.c").value("foo", 'bar');
        zone("x.y.z").value("foo", 'bar');
        zone("a.b").value("-foo", 'bar');

        var names = zone.names(/^.*b.*$/);
        expect(names.length).toBe(1);
        expect(names).toContain('a.b.c.foo');
    });

    it("should enumerate the names with a filter function", function() {
        zone("a.b.c").value("foo", 'bar');
        zone("x.y.z").value("foo", 'bar');
        zone("a.b").value("#foo", 'bar');

        var names = zone.names(function(x) {
            return x.indexOf('y.') > 0;
        });
        expect(names.length).toBe(1);
        expect(names).toContain('x.y.z.foo');
    });

    it("should  create a value", function() {
       zone.value('foo','bar'); 
    });
    
    it("should define $$zone as a predefined injectable object", function() {
        var Z = zone.get("$$zone");
        expect(Z).toBe(zone);
    });
    
    it("should copy $$zone properly when copying a zone", function() {
        var Z = zone.get("$$zone");
        var zone2 = zone.copyZone();
        var Z2 = zone2.get('$$zone');
        expect(Z2).toBe(zone2);
    });
});
