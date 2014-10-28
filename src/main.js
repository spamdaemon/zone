/**
 * A private object that maintains and creates modules.
 * 
 * @param console
 *            the console object to use
 * @param {...}
 *            undefined the undefined value (works even if someone redefined it)
 */
(function(console, undefined) {
    'use strict';

    if (this.zone) {
        console.log('Zone has already been defined');
        return this.zone;
    }

    var VERSION = '1.0';

    /** @const */
    var PRIVATE_ACCESS = 2;
    /** @const */
    var PROTECTED_ACCESS = 1;
    /** @const */
    var PUBLIC_ACCESS = 0;

    /**
     * Given a name, determine the access and type values.
     * 
     * @param {!string}
     *            name
     * @return {*} an object indicating the protected level and type
     */
    var parseName = function(name) {
        var result = {};
        switch (name[0]) {
        case '-':
            result.access = PRIVATE_ACCESS;
            result.name = name.substr(1);
            result.prefix = '-';
            break;
        case '+':
            result.access = PUBLIC_ACCESS;
            result.name = name.substr(1);
            result.prefix = '';
            break;
        case '#':
            result.access = PROTECTED_ACCESS;
            result.name = name.substr(1);
            result.prefix = '#';
            break;
        default:
            result.access = PUBLIC_ACCESS;
            result.name = name;
            result.prefix = '';
        }
        return result;
    };

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
     * Parse the formal parameters of a function.<br>
     * TODO: use AngularJS function here instead
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
        this.__fullName = name;

        if (parent) {
            if (parent.__children[name]) {
                throw new Error('Module ' + this.__fullName + ' already contains a module ' + name);
            }
            this.__fullName = makeFullName(parent.__fullName, name);
            this.__root = parent.__root;
            parent.__children[name] = this;
        } else {
            // set up these before initializing the rest of the module
            this.__interceptors = [];
            this.__root = this;
            this.__modules = {};
        }
        // register this module with the root module
        this.__root.__modules[this.__fullName] = this;
    };

    /**
     * Copy a module as is. Any resolved values are not copied, but their unresolved specs are copied.
     * 
     * @param {!Module}
     *            module a module
     * @param {Module}
     *            parent the new parent
     * @return {!Module} a recursive copy of the specified module
     */
    var copyModule = function(name, module, parent) {
        var newModule = new Module(name, parent, null);
        if (module.__imports) {
            newModule.__imports = module.__imports.slice();
        }
        var child, mod;
        if (newModule.__root === newModule) {
            newModule.__interceptors = module.__interceptors.slice();
        }
        for (mod in module.__values) {
            newModule.__values[mod] = module.__values[mod].copy(newModule);
        }
        // recursively copy the children
        for (child in module.__children) {
            copyModule(child, module.__children[child], newModule);
        }
        return newModule;
    };

    /**
     * Create a root module.
     * 
     * @return {!Module} a root module
     */
    var newRootModule = function() {
        return new Module('', null, []);
    };

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
     * @param {!Module}
     *            root the root module
     * @param {!string}
     *            name the name of the module
     * @param {boolean}
     *            createIfNotFound
     * @return {Module} the module or null
     */
    var findModule = function(root, name, createIfNotFound) {
        var m = root.__modules[name], names, i, n;
        m = m || null;
        if (!m && createIfNotFound) {
            names = name.split(/\./);
            m = root;
            for (i = 0, n = names.length; i < n; ++i) {
                m = m.create(names[i], null);
            }
        }
        return m;
    };

    /**
     * Get a module by its path.
     * 
     * @param {!string=}
     *            opt_path the optional path
     * @param {boolean=}
     *            opt_preventImplicitModule true to prevent the module from being created implicitly
     * @return {!Module}
     */
    var getModule = function(root, opt_path, opt_preventImplicitModule) {
        if (!opt_path) {
            return root;
        }
        var m = findModule(root, opt_path, !opt_preventImplicitModule);
        if (m) {
            return m;
        }
        throw new Error('Module not found ' + opt_path);
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
            throw new Error('Invalid function description' + JSON.stringify(args));
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
     * @param {!string}
     *            name the module in which the interceptor will resolve
     * @param {!function(!string,!string):boolean}
     *            selector a boolean function taking two string arguments
     * @param {!FunctionDescriptor}
     *            descriptor the function used to create the interceptor
     */
    var Interceptor = function(name, selector, descriptor) {
        // only use the full module name, because then we can use
        this.name = name;
        this.selector = selector;
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
        this.hasValue = false;
        this.value = null;
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
     * Clone this resolvable.
     * 
     * @param {!Module}
     *            newModule the target module into which the resolvable will be installed
     * @return {!Resolvable} the resolvable
     */
    Resolvable.prototype.copy = function(newModule) {
        return new Resolvable(newModule, this.name, this.access, this.descriptor);
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
     * @param {!Module}
     *            root the root module
     * @param {!string}
     *            path a path name to parse
     * @param {!Module}
     *            module the default module
     */
    var Path = function(root, path, module) {
        this.module = module;
        this.local = path;
        this.modulePath = '.';

        var i;
        i = path.lastIndexOf('.');
        if (i >= 0) {
            this.modulePath = path.substring(0, i);
            this.local = path.substr(i + 1);
            this.module = findModule(root, this.modulePath, false);
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
     * @param {!boolean}
     *            recurse allow recursion
     * @param {!Object}
     *            recursionGuard the recursion guard is necessary to detect cyclic dependencies
     * @return {?Resolvable} a resolvable object or null if not found
     */
    var findResolvable = function(name, start, access, recurse, recursionGuard) {
        var i, n, local, depends;
        var current, resolvable, imports;
        var path = new Path(start.__root, name, start);
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

            if (!recurse) {
                break;
            }

            // finish the loop if we've found a locally defined object
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
                        depends = findModule(start.__root, imports[i], false);
                        if (depends === null) {
                            throw new Error('Invalid dependency : ' + imports[i]);
                        }
                        // do not search recursively
                        resolvable = findResolvable(local, depends, PUBLIC_ACCESS, false, recursionGuard);
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
     * @param {boolean}
     *            bindNullToThis if true, then the this pointer for the returned function is bound the the module
     * @return {function()|null} a function that calls the specified function with the appropriately injected values or
     *         null if the injection failed
     * @throws Error
     *             if a cyclic dependency was detected
     */
    var injectFunction = function(module, access, descriptor, allowFreeArguments, bindNullToThis) {
        var i, n, isConstructor, freeArgs, args, r;
        var name, value, optional, names, func;

        names = descriptor.names;
        func = descriptor.func;
        isConstructor = descriptor.isConstructor;
        freeArgs = [];

        // loop over each argument name and instantiate it as well
        // putting module into args[0] will bind the null to this
        args = [ null ];

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
                r = findResolvable(name, module, access, true, {});

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
            if (!bindNullToThis) {
                args[0] = this;
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
     * @return {*} a value for the resolvable
     * @throws Error
     *             if a cyclic dependency was detected
     */
    var resolveValue = function(R) {
        var fn, interceptors, module, interceptor, interceptFN, value, i, n;

        if (R.hasValue) {
            return R.value;
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
                    fn = injectFunction(R.module, PRIVATE_ACCESS, R.descriptor, false, true);
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

        interceptors = R.module.__root.__interceptors;

        // apply all interceptors, which is in arbitrary order
        for (i = 0, n = interceptors.length; i < n; ++i) {
            interceptor = interceptors[i];
            if (interceptor.selector(R.module.__fullName, R.name)) {
                try {
                    module = getModule(R.module.__root, interceptor.name, true);
                    interceptFN = injectFunction(module, PRIVATE_ACCESS, interceptor.descriptor, false, true);
                } catch (error) {
                    console.log('Interceptor for ' + R.fullName + ' failed');
                    throw error;
                }
                if (interceptFN === null) {
                    throw new Error('Failed to resolve interceptor for ' + R.name);
                }
                value = interceptFN()(value, R.module.__fullName, R.name);
            }
        }

        R.value = value;
        R.hasValue = true;

        return value;
    };

    /**
     * Inject a function with values from this module. The this pointer will be bound to the current this pointer.
     * 
     * @expose
     * @param {...}
     *            var_args a function descriptor
     * @return {Function} a function
     */
    Module.prototype.inject = function(var_args) {
        var descriptor = createFunctionDescriptor(arguments);
        descriptor.validateInjectionParameterNames("#?", "");
        var fn = injectFunction(this, PUBLIC_ACCESS, descriptor, true, false);
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
        var R = findResolvable(name, this, PUBLIC_ACCESS, true, {});
        if (R) {
            return resolveValue(R);
        }
        throw new Error('Not found ' + name);
    };

    /**
     * Define a factory object. The name starts with modifier characters, such as, '#', '+', '-' then the value will
     * accessible as protected, public, or private respectively. If no access modier is provided, then access default to
     * public access.
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
        var parsedName = parseName(name);
        return define(this, parsedName.name, parsedName.access, [ desc ]);
    };

    /**
     * Define a service. The name starts with modifier characters, such as, '#', '+', '-' then the value will accessible
     * as protected, public, or private respectively. If no access modier is provided, then access default to public
     * access.
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
        var parsedName = parseName(name);
        return define(this, parsedName.name, parsedName.access, [ desc ]);
    };

    /**
     * Define a value. The name starts with modifier characters, such as, '#', '+', '-' then the value will accessible
     * as protected, public, or private respectively. If no access modier is provided, then access default to public
     * access.
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
        var parsedName = parseName(name);
        return define(this, parsedName.name, parsedName.access, [ desc ]);
    };

    /**
     * Define a constant value. The name starts with modifier characters, such as, '#', '+', '-' then the value will
     * accessible as protected, public, or private respectively. If no access modier is provided, then access default to
     * public access.
     * <p>
     * This method will freeze and seal the provided constant value.
     * 
     * @expose
     * @param {!string}
     *            name the name of the object to be bound
     * @param {*}
     *            value a value
     * @return {!Module} this module
     */
    Module.prototype.constant = function(name, value) {
        ensureMinArgs(arguments, 2);
        if (value !== null) {
            var type = typeof value;
            // only objects can be frozen
            if (type === 'object' || type === 'function') {
                Object.freeze(value);
                Object.seal(value);
            }
        }
        var desc = createValueDescriptor(value);
        var parsedName = parseName(name);
        return define(this, parsedName.name, parsedName.access, [ desc ]);
    };

    /**
     * Define an interceptor for values, factories, and services. The interceptor is invoked when the named object in
     * this module is resolved for the first time. The interception function can be injected and must return a function
     * that can be used to inject.
     * <p>
     * If the selector is a function then it must be a function of the form. Function interceptors are set globally and
     * are not just associated with this this module!!!
     * 
     * <pre>
     * function(FullModuleName,LocalValueName) { return true or false; }
     * </pre>
     * 
     * and must not perform any zone functions. If any zone function, e.g module lookup, is performed, then the result
     * is UNDEFINED and subject to change.
     * 
     * @expose
     * @param {!string|function(!string,!string):boolean}
     *            selector the name of the object to be intercepted
     * @param {...}
     *            var_args an injectable function that produce a function that takes a value and returns a value
     * @return {!Module} this module
     */
    Module.prototype.interceptor = function(selector, var_args) {
        var module = this;
        if (typeof selector === 'string') {
            // find the module in which we want
            var path = new Path(this.__root, selector, this);
            module = path.module;
            if (module === null) {
                module = findModule(this.__root, path.modulePath, true);
            }
            // selector is just a local name
            selector = function(m, l) {
                return module.__fullName === m && l === path.local;
            };
        }
        if (typeof selector !== 'function') {
            throw new Error("Invalid interceptor " + selector);
        }

        var args = Array.prototype.slice.call(arguments, 1);
        var descriptor = createFunctionDescriptor(args);
        descriptor.validateInjectionParameterNames("?", "#");
        // register the interceptor with the root module
        this.__root.__interceptors.push(new Interceptor(this.__fullName, selector, descriptor));
        return this;
    };

    /**
     * Create a new zone.
     * 
     * @param {!Module}
     *            ROOT the root module
     */
    var newZone = function(ROOT) {

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
        var zone = function(opt_path, opt_preventImplicitModule) {
            // do not call
            return getModule(ROOT, opt_path, opt_preventImplicitModule);
        };

        /**
         * Create a function descriptor. This value may be passed to any of the define functions or the inject function.
         * 
         * @expose
         * @param {...*}
         *            var_args
         * @return {FunctionDescriptor} a function descriptor
         */
        zone.asFunction = function(var_args) {
            checkArguments(arguments, 1, 2);
            return createFunctionDescriptor(arguments);
        };

        /**
         * Create a descriptor for a constructor function. Functions defined as constructors will be instantiated using
         * the new operator during injection time.
         * 
         * @expose
         * @param {...*}
         *            var_args
         * @return {FunctionDescriptor} a function descriptor
         */
        zone.asConstructor = function(var_args) {
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
        zone.asValue = function(value) {
            checkArguments(arguments, 1, 1);
            return createValueDescriptor(value);
        };

        /**
         * An injection function. This works much like zone(name).inject(...). It's very useful to use this during
         * testing. Note that the lookup of the injections are only made when the resulting function is invoked.
         * 
         * @expose
         * @param {!string=}
         *            opt_name the name of optional module which to use for injection
         * @param {...}
         *            var_args the arguments
         * @return {function()} a function
         */
        zone.inject = function(opt_name, var_args) {
            checkArguments(arguments, 1, 3);

            var THIS = this;
            var module = '';
            var args = arguments;
            if (typeof arguments[0] === 'string') {
                module = opt_name;
                args = Array.prototype.slice.call(args, 1);
            }

            var descriptor = createFunctionDescriptor(args);

            // cache the resolved value in the closure
            var resolvedFN = null;
            return function() {
                if (resolvedFN === null) {
                    var m = getModule(ROOT, module, true);
                    resolvedFN = m.inject(descriptor);
                }
                return resolvedFN.apply(this, arguments);
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
        zone.get = function(name) {
            checkArguments(arguments, 1, 1);

            var path = new Path(ROOT, name, ROOT);
            if (path.module === null) {
                throw new Error('Not found ' + name);
            }
            return path.module.get(path.local);
        };

        /**
         * Define a factory object. The name starts with modifier characters, such as, '#', '+', '-' then the value will
         * accessible as protected, public, or private respectively. If no access modier is provided, then access
         * default to public access.
         * 
         * @expose
         * @param {!string}
         *            name the full name of the object to be bound
         * @param {...*}
         *            var_args
         * @return {!*} the zone instance
         */
        zone.factory = function(name, var_args) {
            var pname = parseName(name);
            var path = new Path(ROOT, pname.name, ROOT);
            var m = getModule(ROOT, path.modulePath);
            var args = Array.prototype.slice.call(arguments);
            args[0] = pname.prefix + path.local;
            Module.prototype.factory.apply(m, args);
            return zone;
        };

        /**
         * Define a service. The name starts with modifier characters, such as, '#', '+', '-' then the value will
         * accessible as protected, public, or private respectively. If no access modier is provided, then access
         * default to public access.
         * 
         * @expose
         * @param {!string}
         *            name the full name of the object to be bound
         * @param {...*}
         *            var_args
         * @return {!*} the zone instance
         */
        zone.service = function(name, var_args) {
            var pname = parseName(name);
            var path = new Path(ROOT, pname.name, ROOT);
            var m = getModule(ROOT, path.modulePath);
            var args = Array.prototype.slice.call(arguments);
            args[0] = pname.prefix + path.local;
            Module.prototype.service.apply(m, args);
            return zone;
        };

        /**
         * Define a value. The name starts with modifier characters, such as, '#', '+', '-' then the value will
         * accessible as protected, public, or private respectively. If no access modier is provided, then access
         * default to public access.
         * 
         * @expose
         * @param {!string}
         *            name the full name of the object to be bound
         * @param {*}
         *            value a value
         * @return {!*} the zone instance
         */
        zone.value = function(name, value) {
            var pname = parseName(name);
            var path = new Path(ROOT, pname.name, ROOT);
            var m = getModule(ROOT, path.modulePath);
            m.value(pname.prefix + path.local, value);
            return zone;
        };

        /**
         * Define a constant value. The name starts with modifier characters, such as, '#', '+', '-' then the value will
         * accessible as protected, public, or private respectively. If no access modier is provided, then access
         * default to public access.
         * <p>
         * This method will freeze and seal the provided constant value.
         * 
         * @expose
         * @param {!string}
         *            name the full name of the object to be bound
         * @param {*}
         *            value a value
         * @return {!*} the zone instance
         */
        zone.constant = function(name, value) {
            var pname = parseName(name);
            var path = new Path(ROOT, pname.name, ROOT);
            var m = getModule(ROOT, path.modulePath);
            m.constant(pname.prefix + path.local, value);
            return zone;
        };

        /**
         * Create a new zone in a pristine state.
         * 
         * @expose
         * @return a new zone
         */
        zone.makeZone = function() {
            return newZone(newRootModule());
        };

        /**
         * Create a copy of this zone before before anything had been resolved. This method is very useful for testing
         * and mocking up services.
         * 
         * @expose
         * @return a new zone that has copied all interceptors and descriptors.
         */
        zone.copyZone = function() {
            return newZone(copyModule('', ROOT, null));
        };

        /**
         * Get the names of object.
         * 
         * @expose
         * @param {...}
         *            var_args an optional filter function or regexp
         * @return the names of publicly accessible objects.
         */
        zone.names = function(var_args) {
            var filter, i, n, root, name, value, result = [], resolvable;
            if (typeof var_args === 'function') {
                filter = var_args;
            } else if (var_args instanceof RegExp) {
                filter = function(x) {
                    return var_args.test(x);
                };
            } else {
                filter = function() {
                    return true;
                };
            }
            for (name in ROOT.__modules) {
                for (value in ROOT.__modules[name].__values) {
                    resolvable = ROOT.__modules[name].__values[value];
                    if (resolvable.access === PUBLIC_ACCESS && filter(resolvable.fullName)) {
                        result.push(resolvable.fullName);
                        console.log("Resolvable " +resolvable.fullName+", "+resolvable.access);
                    }
                }
            }
            result.sort();
            return result;
        };

        /**
         * Get the version of zone.
         * 
         * @expose
         * @return {!string} the current version of zone
         */
        zone.version = function() {
            return VERSION;
        };

        return zone;
    };

    /**
     * @expose
     */
    this.zone = newZone(newRootModule());

    return this.zone;
}).call(this, console || {
    log : function() {
    }
});
