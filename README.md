Zone API
========

This library provides a way to organize code in modules with automatic dependency management. Another feature is dependency injection for singleton objects and services.



Features
--------

Zone provides the ability to
* define modules hierarchically
* define public, protected, and private objects
* inject defined objects into functions


TODO
----




Unit Testing
------------

Unit testing is supported by [Jasmine](http://pivotal.github.io/jasmine/)
and [Karma](http://karma-runner.github.io/).


Contribute
----------

If you find this project useful and want to report a problem, please provide a unit test case.


API
---

1. Core
  * [zone()](#zone)
  * [zone(path)](#zonepath)
  * [zone(path,preventCreation)](#zonepathpreventcreation)

1. Module
  1. Create Module
    * [Module.create(name)](#modulecreatename)
    * [Module.configure(imports)](#moduleconfigureimports)
    
  1. Define Objects
    * [Module.factory(name,function)](#moduleFactory)
    * [Module.service(name,constructor)](#moduleService)
    * [Module.value(name,value)](#moduleValue)
    * [Module.constant(name,value)](#moduleConstant)
    
  1. Access Objects
    * [Module.get(name)](#modulegetname)
    * [Module.inject(function)](#moduleinjectfunction)
  
1. Core Helpers
  * [zone.asFunction(function)](#asFunction)
  * [zone.asConstructor(constructor)](#asConstructor)
  * [zone.asValue(value)](#asValue)
  * [zone.inject(function)](#inject)
  * [zone.inject(modulePath,function)](#inject)
  * [zone.get(fullname)](#zonegetfullname)
  * [zone.reset()](#reset)


# Core

## zone()

Use this function to access the root module. The root module is the module from which all other modules inherit. 
```js
var root = zone();
```

## zone(path)

Use this function to access a module by its full pathname. The module's path name is a dot-separated list of simple names. Any modules in the path are implicitly created if they do not already exist.

```js
var github = zone("com.github");
```

## zone(path,preventCreation)

Use this function to access an existing module without implicitly creating any modules. If the named module does not exist, then an error is thrown.
```js
try {
  return zone("com.github",true);
}
catch (notfound) {
  console.log(notfound.message);
  return null;
}
```


# Module

Modules provide a namespace for name-value pairs. Name-value pairs are constant for the duration of the application, i.e once bound, they cannot be rebound. Modules can be created implicitly or explicitly, but in either case, they can be configured as long as no name lookups have been performed by the module.

Names in a module can be bound as private, protected, or public names. Private names are visible only to other names in the same module, protected names are visible from child modules, and public names are visible by anyone. 

It is possible to use factory functions or constructor functions to provide the value to which name is bound at runtime. These functions are only called once to establish the bound value, for the duration of the module, and they are subject to injection. There are three different ways in which constructor and factory functions can be specified:
 1. a normal function, such as `function(foo,bar)`;  when functions are specified in this way, the names of the parameters are used to lookup values in the same module and those values are passed to the function (factory or constructor). 
	```js
		zone().factory("add", function(x,y) { return x+y; });
	```  
 1. a two-parameter function is specified as two separate parameters, where the first is an array of names, and the second is the factory or constructor function. Each i'th entry in the array is used to determine the value for the i'th function parameter. 
	```js
		zone().factory("add", ["x","y"], function(a,b) { return a+b; });
	``` 
 1. a single array where the first N values are names  and the last value is the factory or constructor function taking N arguments. This is the same format that the angular framework uses.
	```js
		zone().factory("add", ["x","y",function(a,b) { return a+b; }]);
	``` 

The first way of specifying functions is discouraged, because it suffers from a couple of draw-backs:
 1. When using code optimizers, such as Google closure, the functions argument names will be changed and so they cannot be used to lookup values anymore.
 1. If there are too many parameters, then the injector cannot properly determine the function signature.

On the other hand, using two alternate approaches allow some control over the injected values:
 1. If the name starts with a `?` character, then it is assumed to be optional and no error is thrown if the value is unknown. The corresponding function parameter is bound to `undefined`.

## Setting up a module

### Module.create(name)

Use this method to create a child module. 

```js
var root = zone();
var child = root.create("child");
```

This code is equivalent to 
```js
var child = zone("child");
```

### Module.configure(imports)

Modules can import other modules which affects the lookup of objects by a simple name. 

```js
var child = zone("child").configure(["sibling"]);
```

A module can only be configured once and only if the module has not been used for lookups yet.

## Defining Values and Object in a Module

A module allows the definition of four types of values to a name:
 * factory functions are functions that return the value that will ultimately be bound
 * service functions are constructors that will be used to create an object that will be bound the name
 * values a primitive values or objects that are bound as is to a name
 * constant values are frozen and sealed values that are bound to a name in the module

When registering a value, function, etc. with a module, the name can be used to indicate public, protected, or private access for the value. To indicate access level use
 * public: the name starts with a '+' character
 * protected: the name starts with a '#' character
 * private: the name starts with a '-' character
If no access level indication is provided, then public access is assumed. Note that the access level indicator is not part of the registered name. For example,
```js
zone().value('+foo','bar');
zone().get('foo');
```

Factory functions and service constructors are eligible for injection. The functions are only executed once, upon the first lookup of the symbol to which they are bound. Once bound, the value returned is the same for the lifetime of the module.

It is possible to use interceptors on the first lookup of a named to modify the value or even return a new value.

    
### Module.factory(name,function)
Bind a factory function to a name within the given module. The factory function will be executed and its return value is the value returned upon lookup or injection of the name. 
   
### Module.service(name,constructor)
Bind a constructor function to the given name in the module. The constructor is invoked upon the first lookup of the name and the created object is returned upon each lookup of the name. 
  
### Module.value(name,value)
Bind a value to a name in the module.

### Module.constant(name,value)
Bind a constant value to a name in the module. If the value is a function or object, then it is frozen
and sealed and can thus not be modified in any way.

## Module Extensions    
    
### Module.interceptor(name,function)

It is possible to extend or modify existing module objects by intercepting their creation. The name is that of an object in the module and the function is an injectable function that returns a function of a single parameter, which is the module object. The following contrived example illustrates how interceptors can be used.

Assume the basic module is define in some file, greeting.js
```js
var module = zone("greeting");
module.exportValue("phrase","Hello, World!");
```

and that later on some would like to use the greeting, but modify it slightly to support greetings in their own language. So, they create a file greeting-de.js
```js
var module = zone("greeting");
module.interceptor("phrase",['language', function(lang) {
   return function(v) {
      // if the language is German, return a specific greeting
      if (lang === 'de') {
        return "Hallo, Welt!";
      }
      // return the default greeting
      return v;
   };
}]);

module.exportValue("language",'de');
```
Thus, ```zone.get('greeting.phrase')``` will now always yield "Hallo, Welt!" instead of the default "Hello, World!".


## Getting Values and Injections

### Module.get(name)

Lookup a named object in the module. If the name is a simple name, then name is first looked up in the module itself. If the name is not found in the module, then each imported module is checked recursively. If no imported module defines a value, then the parent of the module is used to lookup the value. If the value is not found, then an error is thrown.

```js
try {
  var foo = zone("child").get("foo");
}
catch (notfound) {
  console.log("foo not found");
}
```

 If the name is an absolute name this method acts exactly like [zone.get(fullname)](#zonegetfullname). Thus, the following holds true:
```js
zone("child").get("sibling.foo") === zone("sibling").get("foo") === zone.get("sibling.foo")
```


### Module.inject(function)

This function wraps a given function in a new function and resolves the names of the parameters.

The following code 
```js
  var g  = function(foo,bar) { ... };
  var fn = zone("child").inject(g);
```

is roughly equivalent to this code:
```js
  var g = function(foo,bar) { ... };
  var fn = function() {
    var foo = zone("child").get('foo');
    var bar = zone("child").get('bar');
    return f(foo,bar);
  };
```

Using a slightly different notation for the function, it is also possible for the generated function to take parameters. For example,
```js
  var g = function(a,b,x,y) { return [a,b,x,y]; };
  zone("child").exportValue("foo", 1);
  zone("child").exportValue("bar", 2);
  var fn = zone("child").inject(['foo','bar','#x','#y',g]);
  var z = fn(3,4);
```

is roughly equivalent to this code:
```js
  var g = function(a,b) { return [a,b,x,y]; };
  var fn = function(x,y) { 
    var foo = zone("child").get('foo');
    var bar = zone("child").get('bar');
    return f(foo,bar,x,y);
  };
  var z = fn(3,4);
```

and will yield the array ```[1,2,3,4]```

When using explicit names for the function parameters, then a couple of options are available to control what is injected:
 1. if the name starts with a `?`, the corresponding function parameter is optional and if the name cannot be resolved to a value, then it is set to undefined.
 1. if the name starts with a `#`, the the corresponding function parameter becomes a parameter of the returned function.
  
It is not allowed to use both `?` and `#` in the same name.