
/**
 * Save the original zone, because it is the one that has the modules saved.
 */
BaseZone = zone;

/**
 * Make a new zone, which will be used from now on
 */
zone = BaseZone.makeZone();
