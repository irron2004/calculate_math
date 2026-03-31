def test_recommendation_item_model():
    from app.models import RecommendationItem
    item = RecommendationItem(nodeId="n1", reason="최근 3번 틀렸어요", score=3.0)
    assert item.nodeId == "n1"
    assert item.reason == "최근 3번 틀렸어요"
    assert item.score == 3.0


def test_recommendations_response_model():
    from app.models import RecommendationsResponse, RecommendationItem
    resp = RecommendationsResponse(
        items=[
            RecommendationItem(nodeId="n1", reason="최근 3번 틀렸어요", score=3.0),
            RecommendationItem(nodeId="n2", reason="오랫동안 안 풀었어요", score=1.4),
        ]
    )
    assert len(resp.items) == 2
    assert resp.items[0].nodeId == "n1"


def test_compute_recommendations_empty():
    """No sessions → no recommendations."""
    import os, tempfile
    from app.db import get_connection, init_db
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        path = f.name
    conn = get_connection(path)
    init_db(conn)
    from app.api import _compute_recommendations
    result = _compute_recommendations("user1", conn)
    conn.close()
    os.unlink(path)
    assert result == []
