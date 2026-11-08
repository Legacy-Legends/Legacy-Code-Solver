import io
import zipfile

from fastapi.testclient import TestClient

from backend.agent import chat_with_pet, generate_proposal, resolve_blast_query
from backend.api.main import app


def test_mock_blast_and_pet_are_deterministic():
    graph = {
        "overall_health": 45,
        "nodes": [
            {"id": "web", "name": "Checkout", "path": "Web.java", "health": 60},
            {"id": "auth", "name": "UserAuth", "path": "Auth.java", "health": 30},
        ],
        "edges": [{"id": "e1", "source": "web", "target": "auth"}],
    }
    assert resolve_blast_query("UserAuth", graph).matched_node_ids == ["auth"]
    assert chat_with_pet("How are we doing?", 30, "Viewed graph").mood == "sick"


def test_crownbank_upload_chat_apply_and_export():
    before = """package com.crownbank.legacy.auth;
import java.util.Hashtable;
public class SessionManager {
    private static Hashtable sessions = new Hashtable();
}
"""
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr(
            "crownbank-legacy/src/main/java/com/crownbank/legacy/auth/SessionManager.java",
            before,
        )
    client = TestClient(app)
    uploaded = client.post(
        "/api/projects/upload",
        files={"file": ("crownbank.zip", archive.getvalue(), "application/zip")},
    )
    assert uploaded.status_code == 201
    project_id = uploaded.json()["id"]
    chat = client.post(f"/api/projects/{project_id}/chat", json={"query": "modernize this"})
    assert chat.status_code == 200
    proposal_id = chat.json()["proposal_id"]
    proposal = client.get(f"/api/proposals/{proposal_id}").json()
    assert proposal["diffs"][0]["path"].endswith("SessionManager.java")
    assert "ConcurrentHashMap" in proposal["diffs"][0]["after"]
    applied = client.post(f"/api/proposals/{proposal_id}/apply")
    assert applied.status_code == 200
    assert applied.json()["status"] == "applied"
    assert applied.json()["health_after"] >= applied.json()["health_before"]
    assert client.get(f"/api/projects/{project_id}/export").status_code == 200
