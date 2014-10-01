/**
 * Make the global window object available at the top-level. The window is directly grabbed from the environment.
 */
zone().value("$window", window);
