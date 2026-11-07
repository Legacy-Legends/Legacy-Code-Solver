import pytest
from fastapi.testclient import TestClient
from backend.api import main
from backend.api.integration import impact_for_node
from backend.agent.llm import AgentUnavailable


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('USE_MOCK_AGENT', 'true')
    monkeypatch.setattr(main, 'GRAPH_STATE', main.clone_graph(main.GRAPH_STATE))
    return TestClient(main.app)


def test_server_impact_agrees_with_blast(client):
    graph = client.get('/api/projects/demo/graph').json()
    for node in graph['nodes'][:5]:
        impact = client.get('/api/projects/demo/impact', params={'class_id': node['id']})
        assert impact.status_code == 200
        result = impact.json()
        blast = client.post('/api/projects/demo/blast', json={'query': node['id']}).json()
        items = result['directDependents'] + result['indirectDependents']
        assert {n['node']['id'] for n in items} == set(blast['blast_node_ids']) - {node['id']}
        assert result['totalAffected'] == len(items)
        pairs = {(edge['source'], edge['target']) for edge in graph['edges']}
        for item in items:
            assert all(pair in pairs for pair in zip(item['pathIds'], item['pathIds'][1:]))
            assert item['edge']['id'] in {edge['id'] for edge in graph['edges']}


def test_impact_cycles_and_long_paths():
    graph = {'nodes': [{'id': id, 'name': id} for id in ['a', 'b', 'c', 'd', 'isolate']],
             'edges': [{'id': str(i), 'source': a, 'target': b} for i, (a, b) in enumerate([('a','b'), ('b','c'), ('c','d'), ('b','a')])]}
    result = impact_for_node(graph, 'd')
    assert result['totalAffected'] == 3
    assert result['indirectDependents'][-1]['pathIds'] == ['a', 'b', 'c', 'd']
    assert impact_for_node(graph, 'isolate')['totalAffected'] == 0


def test_integration_config_pet_and_domains(client):
    assert client.get('/api/config').json()['agent_mode'] == 'mock'
    assert not client.get('/api/config').json()['can_apply_proposals']
    graph = client.get('/api/graph').json()
    pet = client.post('/api/projects/demo/pet', json={'query': 'How are we doing?'}).json()
    health = round(graph['overallHealth'])
    assert pet['mood'] == ('sick' if health < 40 else 'okay' if health < 75 else 'thriving')
    tags = client.post('/api/projects/demo/domains').json()
    assert set(tags) == {node['id'] for node in graph['nodes']}
    assert all(tag['domain_inferred'] for tag in tags.values())
    updated = client.get('/api/graph').json()
    assert all(n['domain_tag'] == tags[n['id']]['domain_tag'] for n in updated['nodes'])
    assert client.post('/api/projects/demo/blast', json={'query': graph['nodes'][0]['id']}).json()['affected_domains']


def test_unknown_projects_and_inputs(client):
    assert client.get('/api/projects/missing/impact?class_id=x').status_code == 404
    assert client.get('/api/projects/demo/impact?class_id=missing').status_code == 404
    assert client.post('/api/projects/missing/pet', json={'query':'hi'}).status_code == 404
    assert client.post('/api/projects/missing/domains').status_code == 404
    assert client.post('/api/projects/demo/pet', json={'query':''}).status_code == 422
    assert client.post('/api/projects/demo/pet', json={'query':'x' * 2001}).status_code == 422


def test_provider_failure_is_visible(client, monkeypatch):
    def unavailable(*args):
        raise AgentUnavailable('Provider unavailable')
    monkeypatch.setattr(main, 'chat_with_pet', unavailable)
    monkeypatch.setattr(main, 'infer_domains', unavailable)
    assert client.post('/api/projects/demo/pet', json={'query':'hi'}).status_code == 503
    assert client.post('/api/projects/demo/domains').status_code == 503
