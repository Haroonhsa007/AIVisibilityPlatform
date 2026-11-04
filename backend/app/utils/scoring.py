from dataclasses import dataclass
from math import log10

VOLUME_WEIGHT = 0.40
EASE_WEIGHT = 0.25
GAP_WEIGHT = 0.35
VOLUME_CEILING = 100_000


@dataclass(frozen=True)
class ScoreResult:
    score: float
    components: dict[str, float]


def opportunity_score(
    volume: int | None,
    difficulty: int | None,
    visible: bool | None,
    position: int | None,
    competitors_cited: int,
    competitor_count: int,
) -> ScoreResult | None:
    if volume is None or difficulty is None:
        return None
    volume_norm = min(1, log10(1 + max(0, volume)) / log10(1 + VOLUME_CEILING))
    ease = 1 - min(100, max(0, difficulty)) / 100
    if visible is False:
        fraction = min(max(0, competitors_cited), max(0, competitor_count)) / max(
            1, competitor_count
        )
        gap = 0.5 + 0.5 * fraction
    elif visible is True:
        gap = min(0.3, 0.1 * max(0, (position or 1) - 1))
    else:
        gap = 0.5
    raw = VOLUME_WEIGHT * volume_norm + EASE_WEIGHT * ease + GAP_WEIGHT * gap
    score = round(max(0, min(1, raw)), 3)
    return ScoreResult(score, {"volume_norm": volume_norm, "ease": ease, "gap": gap})
