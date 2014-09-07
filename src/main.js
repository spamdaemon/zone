/**
 * A private object that maintains and creates modules.
 * 
 */
(function() {
    'use strict';

    if (this.zone) {
        console.log('Zone already has been defined');
        return this.zone;
    }

    var VERSION = '1.0';

    /** @const */
    var PRIVATE_ACCESS = 2;
    /** @const */
    var PROTECTED_ACCESS = 1;
    /** @const */
    var PUBLIC_ACCESS = 0;

    // all modules
    var MODULES = {};

    /**
     * Ensure that there is a minimum number of arguments.
     * 
     * @param {!Array|!Arguments}
     *            args
     * @param {!number}
     *            min the minimum number of arguments.
     */
    var ensureMinArgs = function(args, min) {
        if (!(args.length >= min)) {
            throw new Error('Expected at least ' + min + ' arguments, but got ' + args.length);
        }
    };

    /**
     * Check the argument length.
     * 
     * @param {!Array|!Arguments}
     *            args the arguments
     * @param {!number}
     *            min the minimum number of arguments
     * @param {!number}
     *            max the maximum number of arguments
     */
    var checkArguments = function(args, min, max) {
        ensureMinArgs(args, min);
        if (!(args.length <= max)) {
            throw new Error('Expected at most ' + max + ' arguments, but got ' + args.length);
        }
    };

    /**
     * Validate the name of an injectable function.
     * 
     * @param {!string}
     *            name a prefix
     * @param {!string}
     *            allowed the allowed characters
     * @param {!string}
     *            notAllowed the allowed characters
     * @throws error
     *             if the string is not a valid injection name
     */
    var validateInjectionParameterName = function(name, allowed, notAllowed) {
        var i, j, n, x = 0;
        for (i = 0, n = allowed.length; i < n; ++i) {
            j = name.indexOf(allowed[i]);

            if (j > 0) {
                throw new Error('Invalid injection parameter ' + name);
            }
            if (j === 0) {
                ++x;
                if (x > 1) {
                    throw new Error('Invalid injection parameter ' + name);
                }
            }
        }
        for (i = 0, n = notAllowed.length; i < n; ++i) {
            if (name.indexOf(notAllowed[i]) >= 0) {
                throw new Error('Invalid injection parameter ' + name);
            }
        }
    };

    /**
     * Create a fullname.
     * 
     * @param {!string}
     *            prefix a prefix
     * @param {!string}
     *            suffix a suffix
     * @return {!string} the concatenated name
     */
    var makeFullName = function(prefix, suffix) {
        if (prefix === '') {
            return suffix;
        }
        return prefix + '.' + suffix;
    };

    /**
     * Determine if an object is an array
     * 
     * @param {*}
     *            obj an object
     * @return {boolean} true if obj is an array
     */
    var isArray = Array['isArray'];

    if (!isArray) {
        // the built-in array isn't supported, so check for length only
        isArray = function(x) {
            return x.length >= 0;
        };
    }

    /**
     * Ensure that a name is a valid name for binding.
     * 
     * @param {!string}
     *            name a name
     * @throws {Error}
     *             if the name is already bound
     */
    var ensureValidName = function(name) {
        if (name.length === 0 || name.indexOf('.') >= 0) {
            throw new Error('Invalid name to bind ' + name);
        }
    };

    /**
     * Parse the formal parameters of a function. TODO: use AngularJS function here instead
     * 
     * @param {function(...[*])}
     *            f a function taking an variable number of parameters
     * @return {Array.<string>} a an array with the names of the formal parameters
     */
    var parseFormalParameters = function(f) {
        if (typeof f !== 'function') {
            throw new Error('Not a function: ' + f);
        }

        // find the argument names
        var fnString = f.toString();
        var args = fnString.match(/^\s*function\s*(?:\w*\s*)?\(([\s\S]*?)\)/);
        args = args ? (args[1] ? args[1].trim().split(/\s*,\s*/) : []) : null;

        if (args === null) {
            console.log('Failed to parse the function (perhaps it is too long?) : ' + fnString);
        }

        return args;
    };

    /**
     * The Module constructor function.
     * 
     * @constructor
     * @final
     * @param {!string}
     *            name the name of the module within the parent
     * @param {?Module}
     *            parent module
     * @param {Array=}
     *            opt_imports the imported modules
     */
    var Module = function(name, parent, opt_imports) {
        this.__children = {};
        this.__parent = parent;
        this.__imports = opt_imports;
        this.__sealed = false;
        this.__values = {};
        this.__interceptors = {};

        this.__fullName = name;

        if (parent) {
            if (parent.__children[name]) {
                throw new Error('Module ' + this.__fullName + ' already contains a module ' + name);
            }
            this.__fullName = makeFullName(parent.__fullName, name);
            parent.__children[name] = this;
        }
        MODULES[this.__fullName] = this;
    };

    var ROOT = new Module('', null, []);

    /**
     * Get the access that a module has with respect to another module.
     * 
     * @param {Module}
     *            source a module that needs access to the target module
     * @param {Module}
     *            target a module
     * @return {!number} an access level between two modules
     */
    var getAccess = function(source, target) {
        if (source === target) {
            return PRIVATE_ACCESS;
        }
        while (source && source !== target) {
            source = source.__parent;
        }
        return source === null ? PUBLIC_ACCESS : PROTECTED_ACCESS;
    };

    /**
     * Ensure that a modules does not already have a defined value.
     * 
     * @param {!Module}
     *            m a module
     * @param {!string}
     *            name a name
     * @throws {Error}
     *             if the name is already bound
     */
    var ensureNotExists = function(m, name) {
        if (m.__values[name]) {
            throw new Error('Name ' + name + ' already bound in ' + m.__fullName);
        }
    };

    /**
     * Ensure that the module is unsealed.
     * 
     * @param {!Module}
     *            m a module
     * @throws {Error}
     *             if the module is already sealed
     */
    var ensureUnsealed = function(m) {
        if (m.__sealed) {
            throw new Error('Module ' + m.__fullName + ' is sealed');
        }
    };

    /**
     * Find a module by searching either from the start or the root. A search is performed from the root if the name is
     * an absolute name, i.e. contains .
     * 
     * @param {!string}
     *            name the name of the module
     * @param {boolean}
     *            createIfNotFound
     * @return {Module} the module or null
     */
    var findModule = function(name, createIfNotFound) {
        var m = MODULES[name], names, i, n;
        m = m || null;
        if (!m && createIfNotFound) {
            names = name.split(/\./);
            m = ROOT;
            for (i = 0, n = names.length; i < n; ++i) {
                m = m.create(names[i], null);
            }
        }
        return m;
    };

    /**
     * Ensure that the formals and the actuals of a function match up.
     * 
     * @param {!Array}
     *            names the function names
     * @param {!Function}
     *            func the function
     */
    var checkFormals = function(names, func) {
        var formals = parseFormalParameters(func);
        if (formals !== null && formals.length !== names.length) {
            throw new Error('Formals and parameter names do not match');
        }
    };

    /**
     * Create the function description.
     * 
     * @constructor
     * @final
     * @param {Array|Arguments}
     *            args an array of arguments
     */
    var FunctionDescriptor = function(args) {
        var n;
        this.isConstructor = false;

        if (args.length === 1 && isArray(args[0])) {
            // using AngularJS notation
            n = args[0].length;
            this.names = args[0].slice(0, n - 1);
            this.func = args[0][n - 1];
            checkFormals(this.names, this.func);
        } else if (args.length === 2) {
            this.names = args[0].slice();
            this.func = args[1];
            checkFormals(this.names, this.func);
        } else if (typeof args[0] === 'function') {
            this.func = args[0];
            this.names = parseFormalParameters(this.func);
            if (this.names === null) {
                throw new Error('Failed to determine function signature');
            }
        } else {
            throw new Error('Invalid function description');
        }
    };

    /**
     * Validate injection parameters for this descriptor.
     * 
     * @param {!string}
     *            allowed the allowed characters
     * @param {!string}
     *            notAllowed the characters that are not allowed
     */
    FunctionDescriptor.prototype.validateInjectionParameterNames = function(allowed, notAllowed) {
        var n = this.names.length, i;
        for (i = 0; i < n; ++i) {
            validateInjectionParameterName(this.names[i], allowed, notAllowed);
        }
    };

    /**
     * An interceptor.
     * 
     * @constructor
     * @final
     * @param {!Module}
     *            module the module in which the interceptor will resolve
     * @param {!FunctionDescriptor}
     *            descriptor the function used to create the interceptor
     */
    var Interceptor = function(module, descriptor) {
        this.module = module;
        this.descriptor = descriptor;
    };

    /**
     * A descriptor for a value.
     * 
     * @constructor
     * @final
     * @param {*}
     *            value a value
     */
    var ValueDescriptor = function(value) {
        this.value = value;
    };

    /**
     * Create the new value descriptor.
     * 
     * @param {*|ValueDescriptor}
     *            value a value
     * 
     * @return {!ValueDescriptor} a value descriptor
     */
    var createValueDescriptor = function(value) {
        var descriptor;
        if (value instanceof ValueDescriptor) {
            descriptor = value;
        } else {
            descriptor = new ValueDescriptor(value);
        }
        return descriptor;
    };

    /**
     * Create the function description.
     * 
     * @param {!Array|!Arguments|!FunctionDescriptor}
     *            args an array of arguments
     * @return {!FunctionDescriptor} a function descriptor
     */
    var createFunctionDescriptor = function(args) {
        var descriptor;
        if (args instanceof FunctionDescriptor) {
            descriptor = args;
        } else if (args.length === 1 && args[0] instanceof FunctionDescriptor) {
            descriptor = args[0];
        } else {
            descriptor = new FunctionDescriptor(args);
        }
        return descriptor;
    };

    /**
     * Create a constructor function.
     * 
     * @param {!Array|!Arguments|!FunctionDescriptor}
     *            args a function or a descriptor
     * @return {FunctionDescriptor} a function descriptor
     */
    var createConstructorDescriptor = function(args) {

        // get the descriptor for the actual function; later we will use
        // that function and replace it with a wrapper function which will
        // instantiate the original function
        var desc = createFunctionDescriptor(args);
        desc.isConstructor = true;
        return desc;
    };

    /**
     * Create a descriptor.
     * 
     * @param {Array|ValueDescriptor|FunctionDescriptor}
     *            args an argument array
     * @return {!FunctionDescriptor|!ValueDescriptor}
     */
    var guessDescriptor = function(args) {
        if (args instanceof ValueDescriptor || args instanceof FunctionDescriptor) {
            return args;
        }
        if ((args.length === 1) && (typeof args[0] !== 'function') && !(args[0] instanceof FunctionDescriptor)) {
            return createValueDescriptor(args[0]);
        }
        return createFunctionDescriptor(args);
    };

    /**
     * Create a resolve for the specified module.
     * 
     * @constructor
     * @final
     * @param {!Module}
     *            module the module where this resolvable will live
     * @param {!string}
     *            name the name of the resolvable
     * @param {number}
     *            access the access for this resolvable
     * @param {!FunctionDescriptor|!ValueDescriptor}
     *            descriptor a function or value descriptor
     */
    var Resolvable = function(module, name, access, descriptor) {

        this.module = module;
        this.name = name;
        this.fullName = makeFullName(module.__fullName, name);
        this.descriptor = descriptor;
        this.resolving = false;

        switch (access) {
        case PUBLIC_ACCESS:
        case PRIVATE_ACCESS:
        case PROTECTED_ACCESS:
            this.access = access;
            break;
        default:
            throw new Error('Invalid access ' + access);
        }
    };

    /**
     * Check the access level of this resolvable against a given level.
     * 
     * @param {!number}
     *            access a access level
     * @return {boolean} true if this resolvable has at an access level of 'access'
     */
    Resolvable.prototype.isAccessible = function(access) {
        return this.access <= access;
    };

    /**
     * Define a private object which is only accessible to functions defined in the provided module.
     * 
     * @param {!Module}
     *            module the module in which to bind a new object
     * @param {!string}
     *            name the name of the object to be bound
     * @param {!number}
     *            access the access level
     * @param {!Array}
     *            args objects to bind or a function descriptor
     * @return {!Module} the module
     */
    var define = function(module, name, access, args) {
        checkArguments(args, 1, 2);
        ensureValidName(name);
        ensureNotExists(module, name);
        ensureUnsealed(module);
        var desc, R;

        desc = guessDescriptor(args);
        if (desc instanceof FunctionDescriptor) {
            desc.validateInjectionParameterNames("?", "#");
        }
        R = new Resolvable(module, name, access, desc);
        module.__values[name] = R;
        return module;
    };

    /**
     * Split a name into a module and local name part.
     * 
     * @constructor
     * @final
     * @param {!string}
     *            path a path name to parse
     * @param {!Module}
     *            module the default module
     */
    var Path = function(path, module) {
        this.module = module;
        this.local = path;
        this.modulePath = '.';

        var i;
        i = path.lastIndexOf('.');
        if (i >= 0) {
            this.modulePath = path.substring(0, i);
            this.module = findModule(this.modulePath, false);
            this.local = path.substr(i + 1);
        }
    };

    /**
     * Search for a resolvable object starting at a given module.
     * 
     * @param {!string}
     *            name the simple or absolute name of the resolvable
     * @param {!Module}
     *            start the module in which to start searching
     * @param {number}
     *            access the type access granted to the module's resolvables
     * @param {!Object}
     *            recursionGuard the recursion guard is necessary to detect cyclic dependencies
     * @return {?Resolvable} a resolvable object or null if not found
     */
    var findResolvable = function(name, start, access, recursionGuard) {
        var i, n, local, depends;
        var current, resolvable, imports;
        var path = new Path(name, start);
        current = path.module;
        local = path.local;

        if (current !== start) {
            access = Math.min(access, getAccess(start, current));
        }

        recursionGuard = recursionGuard || {};

        resolvable = null;
        while (!resolvable && current) {

            // first, check the module's locally defined resolvables
            // mark this module as seal, since we've started resolution
            current.__sealed = true;

            resolvable = current.__values[local];
            if (resolvable && resolvable.isAccessible(access)) {
                break;
            }
            resolvable = null;

            // finish the loop if we've found a locally define object
            if (!resolvable) {
                // not found
                if (recursionGuard[current.__fullName] === true) {
                    throw new Error('Cyclic dependency : ' + current.__fullName);
                }

                try {
                    recursionGuard[current.__fullName] = true;

                    imports = current.__imports || [];

                    // prevent imports later from being overridden
                    current.__imports = imports;

                    // check the imports
                    for (i = 0, n = imports.length; i < n && !resolvable; ++i) {
                        depends = findModule(imports[i], false);
                        if (depends === null) {
                            throw new Error('Invalid dependency : ' + imports[i]);
                        }
                        resolvable = findResolvable(local, depends, PUBLIC_ACCESS, recursionGuard);
                    }
                } finally {
                    recursionGuard[current.__fullName] = false;
                }

                // check the parent using protected access
                access = PROTECTED_ACCESS;
                current = current.__parent;
            }
        }
        return resolvable;
    };

    /**
     * Inject a function with objects from the specified module. The this pointer will be mapped to the module.
     * 
     * @param {!Module}
     *            module the module
     * @param {number}
     *            access the access
     * @param {FunctionDescriptor}
     *            descriptor the descriptor for the function
     * @param {boolean}
     *            allowFreeArguments true to allow free arguments
     * @return {function()|null} a function that calls the specified function with the appropriately injected values or
     *         null if the injection failed
     * @throws Error
     *             if a cyclic dependency was detected
     */
    var injectFunction = function(module, access, descriptor, allowFreeArguments) {
        var i, n, isConstructor, freeArgs, args, r;
        var name, value, optional, names, func;

        names = descriptor.names;
        func = descriptor.func;
        isConstructor = descriptor.isConstructor;

        freeArgs = [];

        // loop over each argument name and instantiate it as well
        args = [ module ];

        for (i = 0, n = names.length; i < n; ++i) {
            name = names[i];
            if (name[0] === '#') {
                if (!allowFreeArguments) {
                    throw new Error('Free arguments are not allowed');
                }
                freeArgs.push(args.length);
                args.push(undefined);
            } else {
                optional = false;
                if (name[0] === '?') {
                    optional = true;
                    name = name.substr(1);
                }
                // we can use PRIVATE access, since we're resolving locally
                r = findResolvable(name, module, access, {});

                if (r) {
                    try {
                        value = resolveValue(r);
                    } catch (error) {
                        console.log('Injection failed: ' + name);
                        throw error;
                    }
                    args.push(value);
                } else if (optional) {
                    args.push(undefined);
                } else {
                    console.log('Injectable not found: ' + name);
                    return null;
                }
            }
        }
        n = freeArgs.length;

        return function() {
            // copy free arguments over
            for (i = 0; i < n; ++i) {
                args[freeArgs[i]] = arguments[i];
            }

            // create a new function
            var FN = Function.prototype.bind.apply(func, args);

            if (isConstructor) {
                // found this on <a
                // href='http://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible'>
                return new FN();
            } else {
                return FN();
            }
        };
    };

    /**
     * Resolve the value of a resolvable object.
     * 
     * @param {!Resolvable}
     *            R the resolve to be instantiated
     * @return {Object} a value for the resolvable
     * @throws Error
     *             if a cyclic dependency was detected
     */
    var resolveValue = function(R) {
        var fn, interceptors, interceptor, interceptFN, value, i, n;

        if (R.hasOwnProperty('value')) {
            return R['value'];
        }

        if (R.resolving === true) {
            throw new Error('Cyclic dependency detected with ' + R.fullName);
        }

        R.resolving = true;
        if (R.descriptor instanceof ValueDescriptor) {
            value = R.descriptor.value;
        } else {

            try {
                try {
                    fn = injectFunction(R.module, PRIVATE_ACCESS, R.descriptor, false);
                } catch (error) {
                    console.log('Failed to resolve ' + R.fullName);
                    throw error;
                }
                if (fn === null) {
                    console.log('Failed to resolve ' + R.fullName);
                    throw new Error('Failed to resolve ' + R.fullName);
                }
            } finally {
                R.resolving = false;
            }

            try {
                value = fn();
            } catch (error) {
                throw new Error('Failed to resolve ' + R.fullName + '\n' + error.toString());
            }
        }

        interceptors = R.module.__interceptors[R.name] || [];

        // apply all interceptors, which is in arbitrary order
        for (i = 0, n = interceptors.length; i < n; ++i) {
            interceptor = interceptors[i];
            try {
                interceptFN = injectFunction(interceptor.module, PRIVATE_ACCESS, interceptor.descriptor, false);
            } catch (error) {
                console.log('Interceptor for ' + R.fullName + ' failed');
                throw error;
            }
            if (interceptFN === null) {
                throw new Error('Failed to resolve interceptor for ' + R.name);
            }
            value = interceptFN()(value);
        }

        R['value'] = value;
        // the descriptor isn't needed anymore, so clean up
        delete R.descriptor;

        return R['value'];
    };

    /**
     * Inject a function with values from this module. The this pointer will be bound to this module.
     * 
     * @expose
     * @param {...}
     *            var_args a function descriptor
     * @return {Function} a function
     */
    Module.prototype.inject = function(var_args) {
        var descriptor = createFunctionDescriptor(arguments);
        descriptor.validateInjectionParameterNames("#?", "");
        var fn = injectFunction(this, PUBLIC_ACCESS, descriptor, true);
        if (fn === null) {
            throw new Error('Failed to create injected function');
        }
        return fn;
    };

    /**
     * Create a new module that is nested within the current module. If the modules has already been created with
     * imports, then this method throws an exception.
     * 
     * @expose
     * @param {!string}
     *            name the name of this module within the parent module
     */
    Module.prototype.create = function(name) {
        var m;
        if (name.length === 0 || name.indexOf('.') >= 0) {
            throw new Error('Invalid name ' + name);
        }
        m = this.__children[name];
        if (!m) {
            m = new Module(name, this, null);
        }
        return m;
    };

    /**
     * Configure this module.
     * 
     * @expose
     * @param {Array=}
     *            opt_imports direct imports of this module
     */
    Module.prototype.configure = function(opt_imports) {
        if (!isArray(opt_imports)) {
            throw new Error('Imports are not an array');
        }
        if (this.__imports) {
            throw new Error('Module has already been configured ' + this.__fullName);
        }
        ensureUnsealed(this);
        this.__imports = opt_imports.slice();
        return this;
    };

    /**
     * Get the value of a property by its local or absolute path. Only public values can be retrieved.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be resolved.
     * @return {*} a value
     * @throws Exception
     *             if the value could not be created
     */
    Module.prototype.get = function(name) {
        var R = findResolvable(name, this, PUBLIC_ACCESS, {});
        if (R) {
            return resolveValue(R);
        }
        throw new Error('Not found ' + name);
    };

    /**
     * Define a private object which is only accessible to functions defined in this module.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.definePrivate = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        return define(this, name, PRIVATE_ACCESS, Array.prototype.slice.call(arguments, 1));
    };

    /**
     * Define a private object which is only accessible to functions defined in this module or nested modules.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.defineProtected = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        return define(this, name, PROTECTED_ACCESS, Array.prototype.slice.call(arguments, 1));
    };

    /**
     * Associate a value with a public name. If the arguments can be interpreted as a factory function, then the
     * function will be instantiated and its result used as the exported value.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype['export'] = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        return define(this, name, PUBLIC_ACCESS, Array.prototype.slice.call(arguments, 1));
    };

    /**
     * Define a module-private factory object.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.factory = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        var desc = createFunctionDescriptor(Array.prototype.slice.call(arguments, 1));
        return define(this, name, PRIVATE_ACCESS, [ desc ]);
    };

    /**
     * Define a module-private factory object.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.protectedFactory = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        var desc = createFunctionDescriptor(Array.prototype.slice.call(arguments, 1));
        return define(this, name, PROTECTED_ACCESS, [ desc ]);
    };

    /**
     * Define a module-private service.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.service = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        var desc = createConstructorDescriptor(Array.prototype.slice.call(arguments, 1));
        return define(this, name, PRIVATE_ACCESS, [ desc ]);
    };

    /**
     * Define a module-private service.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.protectedService = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        var desc = createConstructorDescriptor(Array.prototype.slice.call(arguments, 1));
        return define(this, name, PROTECTED_ACCESS, [ desc ]);
    };

    /**
     * Define an interceptor for values, factories, and services. The interceptor is invoked when the named object in
     * this module is resolved for the first time. The interception function can be injected and must return a function
     * that can be used to inject.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be intercepted
     * @param {...}
     *            var_args an injectable function that produce a function that takes a value and returns a value
     * @return {!Module} this module
     */
    Module.prototype.interceptor = function(name, var_args) {

        // find the module in which we want
        var path = new Path(name, this);
        var module = path.module;
        if (module === null) {
            module = findModule(path.modulePath, true);
        }
        var args = Array.prototype.slice.call(arguments, 1);
        var descriptor = createFunctionDescriptor(args);
        descriptor.validateInjectionParameterNames("?", "#");
        var interceptor = new Interceptor(this, descriptor);
        var list = module.__interceptors[path.local];
        if (!list) {
            module.__interceptors[path.local] = list = [];
        }
        list.push(interceptor);
        return this;
    };

    /**
     * Define a module-private value.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {*}
     *            value a value
     * @return {!Module} this module
     */
    Module.prototype.value = function(name, value) {
        ensureMinArgs(arguments, 2);
        var desc = createValueDescriptor(value);
        return define(this, name, PRIVATE_ACCESS, [ desc ]);
    };

    /**
     * Define a module-private value.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {*}
     *            value a value
     * @return {!Module} this module
     */
    Module.prototype.protectedValue = function(name, value) {
        ensureMinArgs(arguments, 2);
        var desc = createValueDescriptor(value);
        return define(this, name, PROTECTED_ACCESS, [ desc ]);
    };

    /**
     * Export a public factory object.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.exportFactory = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        var desc = createFunctionDescriptor(Array.prototype.slice.call(arguments, 1));
        return define(this, name, PUBLIC_ACCESS, [ desc ]);
    };

    /**
     * Export public a service object which is defined by a construction function.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {...*}
     *            var_args
     * @return {!Module} this module
     */
    Module.prototype.exportService = function(name, var_args) {
        ensureMinArgs(arguments, 2);
        var desc = createConstructorDescriptor(Array.prototype.slice.call(arguments, 1));
        return define(this, name, PUBLIC_ACCESS, [ desc ]);
    };

    /**
     * Export a public value.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {*}
     *            value a value
     * @return {!Module} this module
     */
    Module.prototype.exportValue = function(name, value) {
        ensureMinArgs(arguments, 2);
        var desc = createValueDescriptor(value);
        return define(this, name, PUBLIC_ACCESS, [ desc ]);
    };

    /**
     * Find a module. If no module is specified, then returns the root module.
     * 
     * @expose
     * @param {!string=}
     *            opt_path the optional path
     * @param {boolean=}
     *            opt_preventImplicitModule true to prevent the module from being created implicitly
     * @return {!Module}
     */
    this.zone = function(opt_path, opt_preventImplicitModule) {
        if (!opt_path) {
            return ROOT;
        }
        var m = findModule(opt_path, !opt_preventImplicitModule);
        if (m) {
            return m;
        }
        throw new Error('Module not found ' + opt_path);
    };

    /**
     * Create a function descriptor. This value may be passed to any of the define functions or the inject function.
     * 
     * @expose
     * @param {...*}
     *            var_args
     * @return {FunctionDescriptor} a function descriptor
     */
    this.zone.asFunction = function(var_args) {
        checkArguments(arguments, 1, 2);
        return createFunctionDescriptor(arguments);
    };

    /**
     * Create a descriptor for a constructor function. Functions defined as constructors will be instantiated using the
     * new operator during injection time.
     * 
     * @expose
     * @param {...*}
     *            var_args
     * @return {FunctionDescriptor} a function descriptor
     */
    this.zone.asConstructor = function(var_args) {
        checkArguments(arguments, 1, 2);
        return createConstructorDescriptor(arguments);
    };

    /**
     * Create a descriptor for a value. This function can be used in some circumstances to disambiguate different
     * function representations.
     * 
     * @expose
     * @param {Object}
     *            value a value
     * @return {ValueDescriptor} a value descriptor
     */
    this.zone.asValue = function(value) {
        checkArguments(arguments, 1, 1);
        return createValueDescriptor(value);
    };

    /**
     * An injection function. This works much like zone(name).inject(...). It's very useful to this use this during
     * testing.
     * 
     * @expose
     * @param {!string=}
     *            opt_name the name of optional module which to use for injection
     * @param {...}
     *            var_args the arguments
     * @return {function()} a function
     */
    this.zone.inject = function(opt_name, var_args) {
        checkArguments(arguments, 1, 3);

        var module = '';
        var args = arguments;
        if (typeof arguments[0] === 'string') {
            module = opt_name;
            args = Array.prototype.slice.call(args, 1);
        }

        var descriptor = createFunctionDescriptor(args);

        return function() {
            var m = zone(module, true);
            var fn = m.inject(descriptor);
            return fn.apply(null, arguments);
        };
    };

    /**
     * Get a public value by its global name.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to get
     * @return {*} an object
     */
    this.zone.get = function(name) {
        checkArguments(arguments, 1, 1);

        var path = new Path(name, ROOT);
        if (path.module === null) {
            throw new Error('Not found ' + name);
        }
        return path.module.get(path.local);
    };

    /**
     * A function that can be used to complete reset the zone.
     * 
     * @expose
     */
    this.zone.reset = function() {
        ROOT = new Module('', null, []);
        MODULES = {};
    };

    /**
     * Get the version of zone.
     * 
     * @expose
     * @return {!string} the current version of zone
     */
    this.zone.version = function() {
        return VERSION;
    };

    return this.zone;
}).call(this);
