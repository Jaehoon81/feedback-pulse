"""
check_dangerous_command.py 패턴 매칭 회귀 테스트.

각 패턴마다:
- 매칭(차단) 케이스: stdin JSON → exit 2 + stderr에 라벨
- 비매칭(통과) 케이스: stdin JSON → exit 0
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "check_dangerous_command.py"


def _run(command: str) -> subprocess.CompletedProcess:
    """stdin으로 PreToolUse hook JSON을 흘려보내고 결과 반환."""
    payload = json.dumps({"tool_name": "Bash", "tool_input": {"command": command}})
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=payload, capture_output=True, text=True, timeout=10,
    )


def _assert_blocked(command: str, label_fragment: str):
    r = _run(command)
    assert r.returncode == 2, f"기대: 차단(exit 2). 실제: exit {r.returncode}\nstderr={r.stderr}"
    assert label_fragment in r.stderr, f"stderr에 '{label_fragment}' 없음:\n{r.stderr}"


def _assert_allowed(command: str):
    r = _run(command)
    assert r.returncode == 0, f"기대: 통과(exit 0). 실제: exit {r.returncode}\nstderr={r.stderr}"


# ---------------------------------------------------------------------------
# 기존 6 패턴
# ---------------------------------------------------------------------------

class TestExistingPatterns:
    def test_rm_rf_blocked(self):
        _assert_blocked("rm -rf /tmp/foo", "rm -rf")

    def test_rm_single_file_allowed(self):
        _assert_allowed("rm foo.txt")

    def test_git_push_force_blocked(self):
        _assert_blocked("git push --force origin master", "git push --force")

    def test_git_push_force_with_lease_allowed(self):
        _assert_allowed("git push --force-with-lease origin master")

    def test_git_reset_hard_blocked(self):
        _assert_blocked("git reset --hard HEAD~1", "git reset --hard")

    def test_git_reset_soft_allowed(self):
        _assert_allowed("git reset --soft HEAD~1")

    def test_git_clean_f_blocked(self):
        _assert_blocked("git clean -fd", "git clean -f")

    def test_git_clean_dry_run_allowed(self):
        _assert_allowed("git clean -n")

    def test_git_branch_d_blocked(self):
        _assert_blocked("git branch -D feat-test", "git branch -D")

    def test_git_branch_lowercase_d_allowed(self):
        _assert_allowed("git branch -d already-merged")

    def test_drop_table_blocked(self):
        _assert_blocked("psql -c 'DROP TABLE users'", "DROP TABLE")

    def test_select_table_allowed(self):
        _assert_allowed("psql -c 'SELECT * FROM users'")


# ---------------------------------------------------------------------------
# 신규 4 패턴
# ---------------------------------------------------------------------------

class TestNewPatterns:
    # >.env redirect
    def test_env_redirect_overwrite_blocked(self):
        _assert_blocked('echo "" > .env.local', "> .env redirect")

    def test_env_redirect_no_space_blocked(self):
        _assert_blocked("echo foo >.env", "> .env redirect")

    def test_envrc_lookalike_redirect_allowed(self):
        # .env-output.log 같은 파일은 .env로 시작하지만 envrc/envoy/env_xxx 다른 파일이므로 통과
        _assert_allowed("npm run build > .env-output.log")

    # cat .env
    def test_cat_env_blocked(self):
        _assert_blocked("cat .env.local", "cat .env")

    def test_cat_env_with_grep_pipe_blocked(self):
        # cat .env.production | head — 파이프 전까지가 .env 노출이므로 차단
        _assert_blocked("cat .env.production", "cat .env")

    def test_cat_package_json_allowed(self):
        _assert_allowed("cat package.json")

    # .env 안전 템플릿 변형 화이트리스트
    def test_cat_env_example_allowed(self):
        _assert_allowed("cat .env.example")

    def test_cat_env_template_allowed(self):
        _assert_allowed("cat .env.template")

    def test_cat_env_test_example_allowed(self):
        _assert_allowed("cat .env.test.example")

    # npm registry change
    def test_npm_config_set_registry_blocked(self):
        _assert_blocked("npm config set registry https://malicious.example.com", "npm registry change")

    def test_npm_install_allowed(self):
        _assert_allowed("npm install react")

    def test_npm_config_get_registry_allowed(self):
        _assert_allowed("npm config get registry")

    # chmod 777/666
    def test_chmod_777_blocked(self):
        _assert_blocked("chmod 777 script.sh", "chmod 777/666")

    def test_chmod_recursive_777_blocked(self):
        _assert_blocked("chmod -R 777 /tmp/build", "chmod 777/666")

    def test_chmod_666_blocked(self):
        _assert_blocked("chmod 666 secret.key", "chmod 777/666")

    def test_chmod_755_allowed(self):
        _assert_allowed("chmod 755 script.sh")


# ---------------------------------------------------------------------------
# 무관 / 엣지 케이스
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_command_allowed(self):
        r = _run("")
        assert r.returncode == 0

    def test_invalid_json_stdin_allowed(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPT)],
            input="not json at all", capture_output=True, text=True, timeout=10,
        )
        assert r.returncode == 0

    def test_non_bash_tool_passes_through(self):
        # tool_input 없으면 cmd 빈 문자열 → 통과
        payload = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "/x"}})
        r = subprocess.run(
            [sys.executable, str(SCRIPT)],
            input=payload, capture_output=True, text=True, timeout=10,
        )
        assert r.returncode == 0
