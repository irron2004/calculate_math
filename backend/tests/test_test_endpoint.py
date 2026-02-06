from __future__ import annotations


def test_test_endpoint_returns_ok(client):
    test_client, _ = client

    response = test_client.get("/api/test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "OK"
    assert payload["message"] == "PM intake test endpoint is active."
