"""Country name -> flag image URL lookup.

Used when a match is created by team name so well-known national teams still get
a flag even though no team data is pre-seeded. Unknown names simply get no flag
(the UI falls back to the team's short code).
"""
from __future__ import annotations

from typing import Optional

_ISO2 = {
    "afghanistan": "af", "albania": "al", "algeria": "dz", "argentina": "ar",
    "australia": "au", "austria": "at", "belgium": "be", "bolivia": "bo",
    "bosnia and herzegovina": "ba", "brazil": "br", "bulgaria": "bg",
    "cameroon": "cm", "canada": "ca", "chile": "cl", "china": "cn",
    "colombia": "co", "costa rica": "cr", "croatia": "hr", "czech republic": "cz",
    "czechia": "cz", "denmark": "dk", "ecuador": "ec", "egypt": "eg",
    "england": "gb-eng", "finland": "fi", "france": "fr", "germany": "de",
    "ghana": "gh", "greece": "gr", "hungary": "hu", "iceland": "is",
    "india": "in", "iran": "ir", "iraq": "iq", "ireland": "ie", "italy": "it",
    "ivory coast": "ci", "cote d'ivoire": "ci", "jamaica": "jm", "japan": "jp",
    "mexico": "mx", "morocco": "ma", "netherlands": "nl", "new zealand": "nz",
    "nigeria": "ng", "north korea": "kp", "northern ireland": "gb-nir",
    "norway": "no", "panama": "pa", "paraguay": "py", "peru": "pe",
    "poland": "pl", "portugal": "pt", "qatar": "qa", "romania": "ro",
    "russia": "ru", "saudi arabia": "sa", "scotland": "gb-sct", "senegal": "sn",
    "serbia": "rs", "slovakia": "sk", "slovenia": "si", "south africa": "za",
    "south korea": "kr", "korea republic": "kr", "spain": "es", "sweden": "se",
    "switzerland": "ch", "tunisia": "tn", "turkey": "tr", "turkiye": "tr",
    "ukraine": "ua", "united states": "us", "usa": "us", "uruguay": "uy",
    "wales": "gb-wls",
}


def flag_for(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    iso = _ISO2.get(name.strip().lower())
    return f"https://flagcdn.com/w320/{iso}.png" if iso else None
