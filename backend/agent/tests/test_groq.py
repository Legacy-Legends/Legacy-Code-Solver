"""Use the real Groq SDK against an in-memory HTTP transport, never a paid service."""
import json
import os
import sys

import groq
import httpx
import pytest
from fastapi.testclient import TestClient

from backend.agent import core, llm
from backend.agent.models import DomainBatch, PetLine, RefactorDraft, TargetSelection


@pytest.fixture(autouse=True)
def clean_provider(monkeypatch):
    for name in ('GROQ_API_KEY', 'OPENAI_API_KEY', 'LLM_PROVIDER', 'AGENT_MODEL', 'USE_MOCK_AGENT'):
        monkeypatch.delenv(name, raising=False)


def install_transport(monkeypatch, handler):
    real_client = groq.Groq
    monkeypatch.setenv('GROQ_API_KEY', 'unit-test-placeholder')
    monkeypatch.setenv('USE_MOCK_AGENT', 'false')
    def client(**kwargs):
        assert kwargs == {'timeout': 20.0, 'max_retries': 1}
        return real_client(http_client=httpx.Client(transport=httpx.MockTransport(handler)), **kwargs)
    monkeypatch.setattr(groq, 'Groq', client)


def completion(content, reason='stop'):
    return httpx.Response(200, json={
        'id': 'test', 'object': 'chat.completion', 'created': 0, 'model': 'openai/gpt-oss-20b',
        'choices': [{'index': 0, 'finish_reason': reason,
                     'message': {'role': 'assistant', 'content': content}}],
    })


def test_default_provider_and_missing_key(monkeypatch):
    assert llm.provider_config().provider == 'groq'
    assert llm.provider_config().model == 'openai/gpt-oss-20b'
    with pytest.raises(llm.AgentUnavailable, match='GROQ_API_KEY'):
        llm.structured_response(PetLine, 'Greet', {})
    monkeypatch.setenv('OPENAI_API_KEY', 'unused-openai-placeholder')
    with pytest.raises(llm.AgentUnavailable, match='GROQ_API_KEY'):
        llm.structured_response(PetLine, 'Greet', {})
    monkeypatch.setenv('LLM_PROVIDER', 'openai')
    assert llm.provider_config().credential_configured
    assert llm.provider_config().model == 'gpt-4o-mini'


def test_invalid_config(monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER', 'unsupported')
    with pytest.raises(llm.AgentUnavailable, match='LLM_PROVIDER'):
        llm.provider_config()
    monkeypatch.setenv('LLM_PROVIDER', 'groq')
    monkeypatch.setenv('AGENT_MODEL', '')
    with pytest.raises(llm.AgentUnavailable, match='AGENT_MODEL'):
        llm.provider_config()


@pytest.mark.parametrize('schema,result', [
    (TargetSelection, {'matched_node_ids': ['auth']}),
    (PetLine, {'message': 'Ready to untangle some code!'}),
    (DomainBatch, {'assignments': [{'node_id': 'auth', 'domain_tag': 'Auth'}]}),
    (RefactorDraft, {'rationale': 'Use a final class', 'diffs': [{'path': 'Auth.java', 'before': 'class Auth {}', 'after': 'final class Auth {}'}]}),
])
def test_official_groq_sdk_sends_strict_schema(monkeypatch, schema, result):
    requests = []
    def handle(request):
        requests.append(request)
        assert request.url == 'https://api.groq.com/openai/v1/chat/completions'
        assert request.headers['authorization'] == 'Bearer unit-test-placeholder'
        body = json.loads(request.content)
        assert body['model'] == 'openai/gpt-oss-20b'
        assert body['response_format']['type'] == 'json_schema'
        contract = body['response_format']['json_schema']
        assert contract['strict'] is True
        assert contract['name'] == schema.__name__
        assert contract['schema'] == schema.model_json_schema()
        assert contract['schema']['additionalProperties'] is False
        assert body['max_completion_tokens'] == 4096
        return completion(json.dumps(result))
    install_transport(monkeypatch, handle)
    assert llm.structured_response(schema, 'Return the schema', {'query': 'test'}).model_dump() == result
    assert len(requests) == 1


@pytest.mark.parametrize('content,reason', [
    ('not-json', 'stop'), ('{"message":123}', 'stop'),
    ('{"message":"hello", "unexpected":"field"}', 'stop'),
    ('{"message":"truncated"}', 'length'), (None, 'stop'),
])
def test_groq_rejects_invalid_and_incomplete_output(monkeypatch, content, reason):
    install_transport(monkeypatch, lambda request: completion(content, reason))
    with pytest.raises(llm.AgentUnavailable):
        llm.structured_response(PetLine, 'Greet', {})


@pytest.mark.parametrize('status,expected', [(401, 'authentication'), (403, 'authentication'), (429, 'quota'), (400, 'JSON Schema')])
def test_provider_errors_are_actionable_and_sanitized(monkeypatch, status, expected):
    def handle(request):
        return httpx.Response(status, json={'error': {'message': 'private-provider-content', 'type': 'test_error'}})
    install_transport(monkeypatch, handle)
    with pytest.raises(llm.AgentUnavailable, match=expected) as error:
        llm.structured_response(PetLine, 'Greet', {})
    assert 'private-provider-content' not in str(error.value)
    assert 'unit-test-placeholder' not in str(error.value)
    assert error.value.__suppress_context__


def test_mock_functions_never_construct_a_provider(monkeypatch):
    import openai
    def fail(*args, **kwargs):
        pytest.fail('Mock mode constructed an LLM client')
    monkeypatch.setattr(groq, 'Groq', fail)
    monkeypatch.setattr(openai, 'OpenAI', fail)
    graph = {'nodes': [{'id': 'auth', 'name': 'Auth', 'path': 'Auth.java', 'health': 40}], 'edges': []}
    assert core.resolve_blast_query('Auth', graph).matched_node_ids == ['auth']
    assert core.generate_proposal(['auth'], graph, {}).status == 'pending'
    assert core.infer_domains(graph['nodes'])['auth'].domain_inferred
    assert core.chat_with_pet('Hi', 40, 'Viewed graph').mood == 'okay'


def test_pet_http_endpoint_uses_groq_when_live(monkeypatch):
    from backend.api.main import app
    requests = []
    def handle(request):
        requests.append(request)
        return completion('{"message":"One refactor at a time!"}')
    install_transport(monkeypatch, handle)
    client = TestClient(app)
    config = client.get('/api/config').json()
    assert config['provider'] == 'groq' and config['credential_configured']
    assert 'unit-test-placeholder' not in json.dumps(config)
    response = client.post('/api/projects/demo/pet', json={'query': 'How are we doing?'})
    assert response.status_code == 200
    assert response.json()['message'] == 'One refactor at a time!'
    assert len(requests) == 1


def test_configuration_check_does_not_reveal_key(monkeypatch, capsys, tmp_path):
    from backend.agent.check_provider import main
    monkeypatch.setattr(os, "environ", dict(os.environ))
    envfile = tmp_path / 'test.env'
    envfile.write_text('LLM_PROVIDER=groq\nGROQ_API_KEY=unit-test-placeholder\nUSE_MOCK_AGENT=false\n')
    monkeypatch.setattr(sys, 'argv', ['check_provider', '--env-file', str(envfile)])
    assert main() == 0
    output = capsys.readouterr().out
    assert 'GROQ_API_KEY: configured' in output
    assert 'unit-test-placeholder' not in output


def test_live_check_requires_explicit_live_mode(monkeypatch, capsys):
    from backend.agent.check_provider import main
    monkeypatch.setattr(sys, 'argv', ['check_provider', '--live'])
    assert main() == 1
    assert 'USE_MOCK_AGENT=false' in capsys.readouterr().err
