import re

_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
_DOMAIN = re.compile(rf"(?:{_LABEL}\.)+(?:[a-z]{{2,63}}|xn--[a-z0-9-]{{2,59}})")


def normalise_domain(value: str) -> str:
    """Return a lowercase DNS hostname; reject URLs, IPs, ports and paths."""
    domain = value.strip().lower()
    if len(domain) > 253 or not _DOMAIN.fullmatch(domain):
        raise ValueError("Use a valid domain without scheme, path, spaces, or port.")
    return domain


def domain_matches(cited_domain: str, target_domain: str) -> bool:
    cited = normalise_domain(cited_domain)
    target = normalise_domain(target_domain)
    return cited == target or cited.endswith("." + target)
