Zone API
========

This library provides a way to organize code in modules with automatic dependency management. Another
feature is dependency injection for singleton objects and services.



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
    
  1. Configure Module
    * [Module.configure(imports)](#moduleconfigureimports)

  1. Define Objects
    * [Module.definePrivate(name,...)](#moduleDefine)
    * [Module.defineProtected(name,...)](#moduleDefine)
    * [Module.export(name,...)](#moduleDefine)
    * [Module.factory(name,function)](#moduleFactory)
    * [Module.protectedFactory(name,function)](#moduleFactory)
    * [Module.exportFactory(name,function)](#moduleFactory)
    * [Module.service(name,constructor)](#moduleService)
    * [Module.protectedService(name,constructor)](#moduleService)
    * [Module.exportService(name,constructor)](#moduleService)
    * [Module.value(name,value)](#moduleValue)
    * [Module.protectedValue(name,value)](#moduleValue)
    * [Module.exportValue(name,value)](#moduleValue)
  1. Interceptors
    * [Module.interceptor(name,function)](#moduleInterceptor)
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

Use this function to access the root module. The root module is the module from which 
all other modules inherit. 
```js
var root = zone();
```

## zone(path)

Use this function to access a module by its full pathname. The module's path name is a 
dot-separated list of simple names. Any modules in the path are implicitly created if they 
do not already exist.

```js
var github = zone("com.github");
```

## zone(path,preventCreation)

Use this function to access an existing module without implicitly creating any modules. If the
named module does not exist, then an error is thrown.
```js
try {
  return zone("com.github",true);
}
catch (notfound) {
  console.log(notfound.message);
  return null;
}
```


## Module.create(name)

Use this method to create a child module.
```js
var root = zone();
var child = root.create("child");
```

This code is equivalent to 
```js
var child = zone("child");
```

## Module.configure(imports)

Modules can import other modules which affects the lookup of objects by a simple name. 

```js
var child = zone("child").configure(["sibling"]);
```

A module can only be configured once and only if the module has not been used for lookups yet.


## Module.get(name)

Lookup a named object in the module. If the name is a simple name, then name is first looked up
in the module itself. If the name is not found in the module, then each imported module is checked recursively. If no
imported module defines a value, then the parent of the module is used to lookup the value.
If the value is not found, then an error is thrown.

```js
try {
  var foo = zone("child").get("foo");
}
catch (notfound) {
  console.log("foo not found");
}
```

 If the name is an absolute name this method acts exactly like [zone.get(fullname)](#zonegetfullname). Thus, the following 
 holds true:
```js
zone("child").get("sibling.foo") === zone("sibling").get("foo") === zone.get("sibling.foo")
```


## Module.inject(function)

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
  var g = function(a,b,x,y) { ... };
  var fn = zone("child").inject(['foo','bar','#x','#y',g]);
  var z = fn(1,2);
```

is roughly equivalent to this code:
```js
  var g = function(a,b) { ... };
  var fn = function(x,y) { 
    var foo = zone("child").get('foo');
    var bar = zone("child").get('bar');
    return f(foo,bar,x,y);
  };
  var z = fn(1,2);
```

