/**
 * A capability system for use with the Willow General Purpose Sync Protocol, conformant with the [Meadowcap specification](https://willowprotocol.org/specs/meadowcap).
 *
 * In Willow, a **namespace** is a self-contained data space with three dimensions: time, path, and subspace. Data entries are designated to points within this three dimensional space.
 *
 * This capability system enforces boundaries on who gets to read and write what data in a Willow namespace. Read or write access can be bestowed, delegated to others, further restricted within a given three dimensional product, or merged together into a single capability.
 *
 * Willow namespaces can be communal or owned, and the subspace or namespace signature scheme will be used for signing and verifying, respectively.
 *
 * This system is meant to be used in tandem with Willow, and **must** be configured to use many of the same parameters (e.g. namespace signature scheme, payload digest encoder) as its parent Willow instance.
 * These parameters can be provided via a `MeadowcapParams` object to construct a `Meadowcap` instance, which will then give you access to lots of useful methods and hopefully not have to think about those parameters anymore.
 *
 * @module
 */

export * from "./src/meadowcap/types.ts";
export * from "./src/meadowcap/meadowcap.ts";

export * from "./src/capabilities/types.ts";
