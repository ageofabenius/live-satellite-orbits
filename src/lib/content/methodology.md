# Methodology


Orbits are propagated through time using the standard SGP4 orbital model via the
MIT-licensed, open-source <a class="info-link" href="https://github.com/shashwatak/satellite-js">satellite.js</a> library.


SGP4 propagation using TLEs loses accuracy the further it is extended from the TLE's
generation time, typically this is on the order of a few to tens of kilometers over
several days. This site is intended for visualization and educational purposes only,
it is not intended for operational use.


Satellite positions are propagated at a fixed tick rate of 5 seconds.
Propagating all ~14,000 active satellites typically takes a few tens of milliseconds. To
ensure smooth animation, positions are linearly interpolated between propagation ticks.


The satellite positions shown are computed using TLEs cached by our server, and by
your web browser's local storage. Updated TLEs are fetched from <a class="info-link" href="https://celestrak.org">Celestrak</a>
approximately once per hour. Satellite orbit propagation is performed client-side in the
web browser.


Publicly available TLEs do not account for real-time propulsive maneuvers. If a
satellite performs a maneuver, its updated orbit will not be reflected until a new TLE
is published.