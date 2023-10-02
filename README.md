# meadowcap-js

A TypeScript implementation of a capability system for use with the Willow
General Purpose Sync Protocol, conformant with the
[Meadowcap specification](https://willowprotocol.org/specs/meadowcap).

In Willow, a **namespace** is a self-contained data space with three dimensions:
time, path, and subspace. A namespace's individual _entries_ belong to points
within this three dimensional space.

_Meadowcap_ enforces boundaries on who gets to read and write what data in a
Willow namespace. Read or write access can be bestowed, delegated to others,
further restricted within a given three dimensional product, or merged together
into a single capability.

These boundaries are mediated by _capabilities_. A capability is an unforgeable
token bestowing read or write access to some data to a particular person, issued
by the owner of that data. These capabilities are cryptographically signed and
verified using generic _signature schemes_ (e.g. ed25519) provided by you.

Meadowcap distinguishes between two types of namespace:

- _Communal namespaces_, where authority is derived from ownership of a given
  _subspace_ key pair. This is a horizontal model where all members of a
  namespace have equal authority, and no-one has authority to all data in the
  namespace.
- _Owned namespace_, where authority is derived from the ownership a given
  _namespace_ keypair. This is a top-down model where the owner of the namespace
  key pair has total control over all data in the namespace, including data
  written by those who have had capabilities delegated to them.

Meadowcap will switch between using a (provided) subspace signature scheme or a
namespace signature scheme depending on whether the namespace is communal or
owned, respectively. Most of the time these schemes will be the same, but you
can provide a trivial subspace scheme to effectively deactivate Willow's
subspaces altogether.

This system is meant to be used in tandem with Willow, and **must** be
configured to use many of the same parameters (e.g. namespace signature scheme,
payload digest encoder) as its parent Willow instance. These parameters can be
provided via a `MeadowcapParams` object to construct a `Meadowcap` instance,
which will then give you access to lots of useful methods and hopefully not have
to think about those parameters anymore.

API documentation can be found [here](TODO).

---

This project was funded through the NGI Assure Fund, a fund established by NLnet
with financial support from the European Commission's Next Generation Internet
programme, under the aegis of DG Communications Networks, Content and Technology
under grant agreement № 957073.
