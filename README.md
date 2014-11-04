Zone API
========

This library provides a way to organize code in modules with automatic dependency management. Another feature is dependency injection for singleton objects and services.
This is small library is basically inspired by [AngularJS](https://angularjs.org/).


Features
--------

Zone provides the ability to
* define modules hierarchically
* define public, protected, and private objects
* inject defined objects into functions
* include or compile modules in an arbitrary order as long as zone.js is loaded first

Unit Testing
------------

Unit testing is done with [Jasmine](http://pivotal.github.io/jasmine/)
and [Karma](http://karma-runner.github.io/).


Contribute
----------

If you find this project useful, please let me know. If you want to report a problem, please provide a unit test case.


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
    
  1. Define Values
    * [Module.factory(name,function)](#modulefactorynamefunction)
    * [Module.service(name,constructor)](#moduleservicenameconstructor)
    * [Module.value(name,value)](#modulevaluenamevalue)
    * [Module.constant(name,value)](#moduleconstantnamevalue)

  1. Module Extensions    
    * [Module.interceptor(name,function)](#moduleinterceptornamefunction)
  
  1. Access Objects
    * [Module.get(name)](#modulegetname)
    * [Module.inject(function)](#moduleinjectfunction)
  
1. Zone Functions
  * [zone.asFunction(function)](#zoneasfunctionfunction)
  * [zone.asConstructor(constructor)](#zoneasconstructorconstructor)
  * [zone.asValue(value)](#zoneasvaluevalue)
  * [zone.inject(function)](#zoneinjectfunction)
  * [zone.inject(modulePath,function)](#zoneinjectmodulepathfunction)
  * [zone.get(fullname)](#zonegetfullname)
  * [zone.factory(name,function)](#zonefactorynamefunction)
  * [zone.service(name,constructor)](#zoneservicenameconstructor)
  * [zone.value(name,value)](#zonevaluenamevalue)
  * [zone.constant(name,value)](#zoneconstantnamevalue) 
  * [zone.makeZone()](#zonemakezone)
  * [zone.copyZone()](#zonecopyzone)
  * [zone.names()](#zonenames)
  * [zone.version()](#zoneversion)

1. Optional Modules
  * [$Array](#array)
  * [$console](#console)
  * [$document](#document)
  * [$indexedDB](#indexeddb)
  * [$Math](#math)
  * [$window](#window)
  * [$Worker](#worker)
  * [$XMLHttpRequest](#xmlhttprequest)

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

Modules can import other modules which affects the lookup of objects by a simple name. The following example,
makes all publicly defined objects of 'sibling' available in 'child':

```js
var child = zone("child").configure(["sibling"]);
```

A module can only be configured once and only if the module has not been used for lookups yet.

## Define Values

A module allows the binding of four types of values to a name:
 * factory: functions that return the value to be bound
 * service: constructors, whose instantiations become the bound values
 * value: these values are bound as is
 * constant: these values are frozen and sealed, but otherwise are bound as is

When registering a value, function, etc. with a module, the name can be used to indicate public, protected, or private access for the value. The following shows how to indicate the access level:
 * public: the name starts with a '+' character
 * protected: the name starts with a '#' character
 * private: the name starts with a '-' character
 
If no access level indicator is provided, then public access is assumed. Note that the access level indicator is not part of the registered name. For example,
```js
zone().value('+foo','bar');
zone().get('foo');
```

Factory functions and service constructors are eligible for injection. The functions are only executed once, upon the first lookup of the symbol to which they are bound. Once bound, the value returned is the same for the lifetime of the module.

It is possible to use interceptors on the first lookup of a name to modify the value or even return a new value.

Note: the current zone is defined as a value and can be used for injection:
```js
var z = zone.get('$$zone');
expect(z).toBe(zone);
```


    
### Module.factory(name,function)
Bind a factory function to a name within the given module. The factory function will be executed and its return value is the value returned upon lookup or injection of the name. 

```js
 zone().factory("foo",function() { 
    return "The Bound Value";
 });
 expect(zone.get("foo")).toBe("The Bound Value");
```
   
### Module.service(name,constructor)
Bind a constructor function to the given name in the module. The constructor is invoked upon the first lookup of the name and the created object is returned upon each lookup of the name. 
  
```js
 // inject bar into the service
 zone().value("bar","bar");
 zone().service("foo",['bar'], function(b) { 
    this.get = function() { return b; };
 });
 expect(zone.get("foo").get()).toBe("bar");
```

### Module.value(name,value)
Bind a value to a name in the module.

```js
 zone().value("foo",{ name : "FOO"});
 expect(zone.get("foo").name).toBe("FOO");
```

### Module.constant(name,value)
Bind a constant value to a name in the module. If the value is a function or object, then it is frozen
and sealed and can thus not be modified in any way.

```js
 zone().constant("Owner",{ name : "John Doe"});
 expect(zone.get("Owner").name).toBe("John Doe");
```


## Module Extensions    
    
### Module.interceptor(name,function)

It is possible to extend or modify existing module objects by intercepting their creation. The name is that of an object in the module and the function is an injectable function that returns a function of a single parameter, which is the module object. The following contrived example illustrates how interceptors can be used.

Assume the basic module is define in some file, greeting.js
```js
var module = zone("greeting");
module.value("phrase","Hello, World!");
```

and that later on some would like to use the greeting, but modify it slightly to support greetings in their own language. So, they create a file greeting-de.js
```js
var module = zone("greeting");
module.interceptor("phrase",['language', function(lang) {
   return function(v,moduleName,VariableName) {
      // if the language is German, return a specific greeting
      if (lang === 'de') {
        return "Hallo, Welt!";
      }
      // return the default greeting
      return v;
   };
}]);

module.value("language",'de');
```
Thus, ```zone.get('greeting.phrase')``` will now always yield "Hallo, Welt!" instead of the default "Hello, World!".


Interceptors can also take a ```function(moduleName,localName)``` as the first parameter to provide a more generic mechanism for intercepting values. For example, using this interceptor, name resolutions can be logged for any value in the module:
```js
zone().interceptor(function(mod,name) {
	return mod === 'FOO';
}, function() {
    return function(v, m, l) {
       console.log("Trace: "+m+", "+l+" : "+JSON.stringify(v));
       return v;
    };
});
```

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
  zone("child").value("foo", 1);
  zone("child").value("bar", 2);
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

When using explicit names for the function parameters, then various options are available to control what is injected:
 1. if the name starts with a `?`, the corresponding function parameter is optional and if the name cannot be resolved to a value, then it is set to undefined.
 1. if the name starts with a `#`, the the corresponding function parameter becomes a parameter of the returned function.
 1. if the name of the injectable is '*', then all accessible values defined in the module will be injected as a hash, indexed by the name of the value.
  
It is not allowed to use both `?` and `#` in the same name.

Some examples:
```js
	zone('child').value('a','A');
	zone('child').value('b','B');
	zone('child').value('-c','C');
	var values = zone.inject(['child.*'],function(values) { return values; })();
	expect(values.a).toBe('A');
	expect(values.b).toBe('B');
```

```js
	zone('child').value('a','A');
	var value = zone.inject(['?child.b'],function(b) { return b; })();
	expect(value).toBeUndefined();
```


# Zone Functions
## zone.asFunction(function)
 TBD
 
## zone.asConstructor(constructor)
 TBD
 
## zone.asValue(value)
 TBD

## zone.inject(function)

This function works similar to [zone.inject(modulePath,function)](#zoneinjectmodulepathfunction), but uses the root module for lookup.
 
## zone.inject(modulePath,function)

Wrap the provided function inside a new function. When the new wrapper function is invoked, the parameters for the original function are bound by looking up values relative to the provided module.
Note that the wrapper function can be created even before the module has been completely defined. Only when the wrapper function is called must the module be properly defined.

The following example shows a Jasmine unit test for this feature:
```js
  var fn = zone.inject("child",['foo', function(f) { return f; }]);
  expect(fn).toThrow();
  zone("child").value("foo",'bar');
  expect(fn()).toBe('bar')
```
 
## zone.get(fullname)

Get the value associated with the full name of a bound value.
  
```js
  zone.get('child.value') === zone('child').get('value')
  zone.get('value') === zone().get('value')
```

## zone.factory(name,function)

Define a factory by its fullname. The following statements are equivalent:
```js
  zone.factory('#org.example.foo', function() { return x; });
  zone('org.example').factory('#foo', function() { return x; });
```

## zone.service(name,constructor)

Define a service by its fullname. The following statements are equivalent:
```js
  zone.service('#org.example.foo', function() { this.value = 3.1415; });
  zone('org.example').service('#foo', function() { this.value = 3.1415; });
```
The return value of this function is the zone object itself.


## zone.value(name,value)

Define a value by its fullname. The following statements are equivalent:
```js
  zone.value('#org.example.foo', 3.1415);
  zone('org.example').value('#foo', 3.1415);
```
The return value of this function is the zone object itself.


## zone.constant(name,value)

Define a constant by its fullname. The following statements are equivalent:
```js
  zone.constant('#org.example.foo', 3.1415);
  zone('org.example').constant('#foo', 3.1415);
```
The return value of this function is the zone object itself.

 
## zone.makeZone()

Create a new pristine zone. This function is primarily useful for unit testing or setting up a local
zone that must not be shared globally. 
```js
  var zone2 = zone.makeZone();
  zone2("mine").value('foo','bar');
```
The return value of this function is the new zone object itself.


## zone.copyZone()

Create a copy of the zone. Any values, services, interceptors, etc. that have been registered with the original zone are copied into the new zone. However, any values that may have been already created are not copied and so all values are subject to re-creation in the new zone. 

```js
  zone().value('foo','bar');
  var zone2 = zone.copyZone();
  expect(zone2.get('foo')).toBe('bar');
```
The return value of this function is the new zone object itself.

## zone.names()

Get the names of all publicly accessible values. An optional filter function or regular expression
can be used to filter the names. The filter function takes the a single parameters, which is the 
full name of the variable.

```js
	var z = zone.makeZone();
	z("a.b.c").value('foo', 'bar');
	var names = z.names(/foo$/);
	expect(names[0]).toBe('a.b.c.foo');
```


## zone.version()

Returns a string for the current version of zone.


# Optional Modules

Several optional factories, services, and values are provided that wrap their native components. These 
definitions do not really add any value beyond the ability to inject them and possibly intercept them.

All these values are defined at the top-level zone, e.g.
```js
 var console = zone.get("$console");
```


NOTE: these modules are lost when a zone is reset, or when a new zone is created.

## $Array

This is a wrapper for the global   Array object.

## $console

This is a wrapper for window.console and is modified to make it work across browsers.


## $document

This is a wrapper for   window.document.


## $indexedDB

This is a wrapper for window.indexedDB.

## $Math

This is a wrapper for the global  Math object.

## $window

This is a wrapper for the global window object.

## $Worker

This is a wrapper for the window.Worker class.

## $XMLHttpRequest

This is a wrapper for the window.XMLHttpRequest class.
