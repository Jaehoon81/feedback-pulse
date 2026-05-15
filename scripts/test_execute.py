"""
execute.py 리팩터링 안전망 테스트.
리팩터링 전후 동작이 동일한지 검증한다.
"""

import io
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import execute as ex


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_project(tmp_path):
    """phases/, CLAUDE.md, docs/ 를 갖춘 임시 프로젝트 구조."""
    phases_dir = tmp_path / "phases"
    phases_dir.mkdir()

    claude_md = tmp_path / "CLAUDE.md"
    claude_md.write_text("# Rules\n- rule one\n- rule two", encoding="utf-8")

    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "arch.md").write_text("# Architecture\nSome content", encoding="utf-8")
    (docs_dir / "guide.md").write_text("# Guide\nAnother doc", encoding="utf-8")

    return tmp_path


@pytest.fixture
def phase_dir(tmp_project):
    """step 3개를 가진 phase 디렉토리."""
    d = tmp_project / "phases" / "0-mvp"
    d.mkdir()

    index = {
        "project": "TestProject",
        "phase": "mvp",
        "steps": [
            {"step": 0, "name": "setup", "status": "completed", "summary": "프로젝트 초기화 완료"},
            {"step": 1, "name": "core", "status": "completed", "summary": "핵심 로직 구현"},
            {"step": 2, "name": "ui", "status": "pending"},
        ],
    }
    (d / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    (d / "step2.md").write_text("# Step 2: UI\n\nUI를 구현하세요.", encoding="utf-8")

    return d


@pytest.fixture
def top_index(tmp_project):
    """phases/index.json (top-level)."""
    top = {
        "phases": [
            {"dir": "0-mvp", "status": "pending"},
            {"dir": "1-polish", "status": "pending"},
        ]
    }
    p = tmp_project / "phases" / "index.json"
    p.write_text(json.dumps(top, indent=2), encoding="utf-8")
    return p


@pytest.fixture
def executor(tmp_project, phase_dir):
    """테스트용 StepExecutor 인스턴스. git 호출은 별도 mock 필요."""
    with patch.object(ex, "ROOT", tmp_project):
        inst = ex.StepExecutor("0-mvp")
    # 내부 경로를 tmp_project 기준으로 재설정
    inst._root = str(tmp_project)
    inst._phases_dir = tmp_project / "phases"
    inst._phase_dir = phase_dir
    inst._phase_dir_name = "0-mvp"
    inst._index_file = phase_dir / "index.json"
    inst._top_index_file = tmp_project / "phases" / "index.json"
    return inst


# ---------------------------------------------------------------------------
# _stamp (= 이전 now_iso)
# ---------------------------------------------------------------------------

class TestStamp:
    def test_returns_kst_timestamp(self, executor):
        result = executor._stamp()
        assert "+0900" in result

    def test_format_is_iso(self, executor):
        result = executor._stamp()
        dt = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert dt.tzinfo is not None

    def test_is_current_time(self, executor):
        before = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0)
        result = executor._stamp()
        after = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0) + timedelta(seconds=1)
        parsed = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert before <= parsed <= after


# ---------------------------------------------------------------------------
# _read_json / _write_json
# ---------------------------------------------------------------------------

class TestJsonHelpers:
    def test_roundtrip(self, tmp_path):
        data = {"key": "값", "nested": [1, 2, 3]}
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, data)
        loaded = ex.StepExecutor._read_json(p)
        assert loaded == data

    def test_save_ensures_ascii_false(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"한글": "테스트"})
        raw = p.read_text(encoding="utf-8")
        assert "한글" in raw
        assert "\\u" not in raw

    def test_save_indented(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"a": 1})
        raw = p.read_text(encoding="utf-8")
        assert "\n" in raw

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ex.StepExecutor._read_json(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# _load_guardrails
# ---------------------------------------------------------------------------

class TestLoadGuardrails:
    def test_loads_claude_md_and_docs(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "# Rules" in result
        assert "rule one" in result
        assert "# Architecture" in result
        assert "# Guide" in result

    def test_sections_separated_by_divider(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "---" in result

    def test_docs_sorted_alphabetically(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        arch_pos = result.index("arch")
        guide_pos = result.index("guide")
        assert arch_pos < guide_pos

    def test_no_claude_md(self, executor, tmp_project):
        (tmp_project / "CLAUDE.md").unlink()
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "CLAUDE.md" not in result
        assert "Architecture" in result

    def test_no_docs_dir(self, executor, tmp_project):
        import shutil
        shutil.rmtree(tmp_project / "docs")
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "Rules" in result
        assert "Architecture" not in result

    def test_empty_project(self, tmp_path):
        with patch.object(ex, "ROOT", tmp_path):
            # executor가 필요 없는 static-like 동작이므로 임시 인스턴스
            phases_dir = tmp_path / "phases" / "dummy"
            phases_dir.mkdir(parents=True)
            idx = {"project": "T", "phase": "t", "steps": []}
            (phases_dir / "index.json").write_text(json.dumps(idx), encoding="utf-8")
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
            result = inst._load_guardrails()
        assert result == ""


# ---------------------------------------------------------------------------
# _build_step_context
# ---------------------------------------------------------------------------

class TestBuildStepContext:
    def test_includes_completed_with_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert "Step 0 (setup): 프로젝트 초기화 완료" in result
        assert "Step 1 (core): 핵심 로직 구현" in result

    def test_excludes_pending(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert "ui" not in result

    def test_excludes_completed_without_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        del index["steps"][0]["summary"]
        result = ex.StepExecutor._build_step_context(index)
        assert "setup" not in result
        assert "core" in result

    def test_empty_when_no_completed(self):
        index = {"steps": [{"step": 0, "name": "a", "status": "pending"}]}
        result = ex.StepExecutor._build_step_context(index)
        assert result == ""

    def test_has_header(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert result.startswith("## 이전 Step 산출물")


# ---------------------------------------------------------------------------
# _build_preamble
# ---------------------------------------------------------------------------

class TestBuildPreamble:
    def test_includes_project_name(self, executor):
        result = executor._build_preamble("", "")
        assert "TestProject" in result

    def test_includes_guardrails(self, executor):
        result = executor._build_preamble("GUARD_CONTENT", "")
        assert "GUARD_CONTENT" in result

    def test_includes_step_context(self, executor):
        ctx = "## 이전 Step 산출물\n\n- Step 0: done"
        result = executor._build_preamble("", ctx)
        assert "이전 Step 산출물" in result

    def test_includes_commit_example(self, executor):
        result = executor._build_preamble("", "")
        assert "feat(mvp):" in result

    def test_includes_rules(self, executor):
        result = executor._build_preamble("", "")
        assert "작업 규칙" in result
        assert "AC" in result

    def test_no_retry_section_by_default(self, executor):
        result = executor._build_preamble("", "")
        assert "이전 시도 실패" not in result

    def test_retry_section_with_prev_error(self, executor):
        result = executor._build_preamble("", "", prev_error="타입 에러 발생")
        assert "이전 시도 실패" in result
        assert "타입 에러 발생" in result

    def test_includes_max_retries(self, executor):
        result = executor._build_preamble("", "")
        assert str(ex.StepExecutor.MAX_RETRIES) in result

    def test_includes_index_path(self, executor):
        result = executor._build_preamble("", "")
        assert "/phases/0-mvp/index.json" in result


# ---------------------------------------------------------------------------
# _update_top_index
# ---------------------------------------------------------------------------

class TestUpdateTopIndex:
    def test_completed(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"
        assert "completed_at" in mvp

    def test_error(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("error")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "error"
        assert "failed_at" in mvp

    def test_blocked(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("blocked")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "blocked"
        assert "blocked_at" in mvp

    def test_other_phases_unchanged(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        polish = next(p for p in data["phases"] if p["dir"] == "1-polish")
        assert polish["status"] == "pending"

    def test_nonexistent_dir_is_noop(self, executor, top_index):
        executor._top_index_file = top_index
        executor._phase_dir_name = "no-such-dir"
        original = json.loads(top_index.read_text())
        executor._update_top_index("completed")
        after = json.loads(top_index.read_text())
        for p_before, p_after in zip(original["phases"], after["phases"]):
            assert p_before["status"] == p_after["status"]

    def test_no_top_index_file(self, executor, tmp_path):
        executor._top_index_file = tmp_path / "nonexistent.json"
        executor._update_top_index("completed")  # should not raise


# ---------------------------------------------------------------------------
# _checkout_branch (mocked)
# ---------------------------------------------------------------------------

class TestCheckoutBranch:
    def _mock_git(self, executor, responses):
        call_idx = {"i": 0}
        def fake_git(*args):
            idx = call_idx["i"]
            call_idx["i"] += 1
            if idx < len(responses):
                return responses[idx]
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

    def test_already_on_branch(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="feat-mvp\n", stderr=""),
        ])
        executor._checkout_branch()  # should return without checkout

    def test_branch_exists_checkout(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_branch_not_exists_create(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="not found"),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_checkout_fails_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="dirty tree"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1

    def test_no_git_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=1, stdout="", stderr="not a git repo"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _commit_step (mocked)
# ---------------------------------------------------------------------------

class TestCommitStep:
    def test_two_phase_commit(self, executor):
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_calls = [c for c in calls if c[0] == "commit"]
        assert len(commit_calls) == 2
        assert "feat(mvp):" in commit_calls[0][2]
        assert "chore(mvp):" in commit_calls[1][2]

    def test_no_code_changes_skips_feat_commit(self, executor):
        call_count = {"diff": 0}
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                call_count["diff"] += 1
                if call_count["diff"] == 1:
                    return MagicMock(returncode=0)
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_msgs = [c[2] for c in calls if c[0] == "commit"]
        assert len(commit_msgs) == 1
        assert "chore" in commit_msgs[0]


# ---------------------------------------------------------------------------
# _invoke_claude (mocked)
# ---------------------------------------------------------------------------

class TestInvokeClaude:
    def test_invokes_claude_with_correct_args(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"result": "ok"}', stderr="")
        step = {"step": 2, "name": "ui"}
        preamble = "PREAMBLE\n"

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            output = executor._invoke_claude(step, preamble)

        cmd = mock_run.call_args[0][0]
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "--dangerously-skip-permissions" in cmd
        assert "--output-format" in cmd
        assert "PREAMBLE" in cmd[-1]
        assert "UI를 구현하세요" in cmd[-1]

    def test_saves_output_json(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"ok": true}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result):
            executor._invoke_claude(step, "preamble")

        output_file = executor._phase_dir / "step2-output.json"
        assert output_file.exists()
        data = json.loads(output_file.read_text())
        assert data["step"] == 2
        assert data["name"] == "ui"
        assert data["exitCode"] == 0

    def test_nonexistent_step_file_exits(self, executor):
        step = {"step": 99, "name": "nonexistent"}
        with pytest.raises(SystemExit) as exc_info:
            executor._invoke_claude(step, "preamble")
        assert exc_info.value.code == 1

    def test_timeout_is_1800(self, executor):
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_claude(step, "preamble")

        assert mock_run.call_args[1]["timeout"] == 1800


# ---------------------------------------------------------------------------
# progress_indicator (= 이전 Spinner)
# ---------------------------------------------------------------------------

class TestProgressIndicator:
    def test_context_manager(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.15)
        assert pi.elapsed >= 0.1

    def test_elapsed_increases(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.2)
        assert pi.elapsed > 0


# ---------------------------------------------------------------------------
# main() CLI 파싱 (mocked)
# ---------------------------------------------------------------------------

class TestMainCli:
    def test_no_args_exits(self):
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2  # argparse exits with 2

    def test_invalid_phase_dir_exits(self):
        with patch("sys.argv", ["execute.py", "nonexistent"]):
            with patch.object(ex, "ROOT", Path("/tmp/fake_nonexistent")):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_missing_index_exits(self, tmp_project):
        (tmp_project / "phases" / "empty").mkdir()
        with patch("sys.argv", ["execute.py", "empty"]):
            with patch.object(ex, "ROOT", tmp_project):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _check_blockers (= 이전 main() error/blocked 체크)
# ---------------------------------------------------------------------------

class TestCheckBlockers:
    def _make_executor_with_steps(self, tmp_project, steps):
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index), encoding="utf-8")

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        return inst

    def test_error_step_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "bad", "status": "error", "error_message": "fail"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 1

    def test_blocked_step_exits_2(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "stuck", "status": "blocked", "blocked_reason": "API key"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# F-1. _execute_single_step 통합 테스트
# ---------------------------------------------------------------------------

class _FakeClaude:
    """`_invoke_claude` mock — 호출 시 index.json의 특정 step status를 변경한다.

    side_effects: 호출 N회마다의 (status, message) 튜플 리스트.
    """
    def __init__(self, executor, step_num: int, side_effects: list):
        self.executor = executor
        self.step_num = step_num
        self.side_effects = list(side_effects)
        self.calls: list = []

    def __call__(self, step: dict, preamble: str):
        self.calls.append({"step": step["step"], "preamble": preamble})
        if not self.side_effects:
            return {"exitCode": 0}
        status, message = self.side_effects.pop(0)
        index = ex.StepExecutor._read_json(self.executor._index_file)
        for s in index["steps"]:
            if s["step"] == self.step_num:
                s["status"] = status
                if status == "completed":
                    s["summary"] = message or "ok"
                elif status == "error":
                    s["error_message"] = message
                elif status == "blocked":
                    s["blocked_reason"] = message
        ex.StepExecutor._write_json(self.executor._index_file, index)
        return {"exitCode": 0}


class TestExecuteSingleStepIntegration:
    def _prepare(self, executor):
        """git 호출 무력화 + step.md 보장."""
        executor._run_git = lambda *args: MagicMock(returncode=1, stdout="", stderr="")
        executor._commit_step = lambda *args: None
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")

    def test_completed_on_first_try(self, executor):
        self._prepare(executor)
        fake = _FakeClaude(executor, step_num=2, side_effects=[("completed", "산출물 요약")])
        executor._invoke_claude = fake
        step = {"step": 2, "name": "ui"}
        result = executor._execute_single_step(step, "GUARD")
        assert result is True
        assert len(fake.calls) == 1
        assert "이전 시도 실패" not in fake.calls[0]["preamble"]

    def test_retry_then_success(self, executor):
        self._prepare(executor)
        fake = _FakeClaude(executor, step_num=2, side_effects=[
            ("error", "타입 에러"),
            ("completed", "성공"),
        ])
        executor._invoke_claude = fake
        (executor._phase_dir / "step2-output.json").write_text(
            json.dumps({"step": 2, "stderr": "TypeError: foo is not defined", "stdout": ""}),
            encoding="utf-8",
        )
        step = {"step": 2, "name": "ui"}
        result = executor._execute_single_step(step, "GUARD")
        assert result is True
        assert len(fake.calls) == 2
        assert "이전 시도 실패" in fake.calls[1]["preamble"]
        assert "TypeError" in fake.calls[1]["preamble"]

    def test_max_retries_then_error(self, executor):
        self._prepare(executor)
        fake = _FakeClaude(executor, step_num=2, side_effects=[
            ("error", "fail 1"), ("error", "fail 2"), ("error", "fail 3"),
        ])
        executor._invoke_claude = fake
        (executor._phase_dir / "step2-output.json").write_text(
            json.dumps({"step": 2, "stderr": "boom", "stdout": ""}), encoding="utf-8",
        )
        step = {"step": 2, "name": "ui"}
        with pytest.raises(SystemExit) as exc_info:
            executor._execute_single_step(step, "GUARD")
        assert exc_info.value.code == 1
        idx = ex.StepExecutor._read_json(executor._index_file)
        s = next(s for s in idx["steps"] if s["step"] == 2)
        assert s["status"] == "error"
        assert "3회 시도 후 실패" in s["error_message"]

    def test_blocked_immediately_exits(self, executor):
        self._prepare(executor)
        fake = _FakeClaude(executor, step_num=2, side_effects=[("blocked", "API 키 필요")])
        executor._invoke_claude = fake
        step = {"step": 2, "name": "ui"}
        with pytest.raises(SystemExit) as exc_info:
            executor._execute_single_step(step, "GUARD")
        assert exc_info.value.code == 2
        assert len(fake.calls) == 1


# ---------------------------------------------------------------------------
# F-2. _execute_all_steps 루프
# ---------------------------------------------------------------------------

class TestExecuteAllStepsLoop:
    def test_skips_completed(self, executor):
        executor._run_git = lambda *args: MagicMock(returncode=1)
        executor._commit_step = lambda *args: None
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")
        fake = _FakeClaude(executor, step_num=2, side_effects=[("completed", "done")])
        executor._invoke_claude = fake
        executor._execute_all_steps("GUARD")
        assert len(fake.calls) == 1
        assert fake.calls[0]["step"] == 2

    def test_started_at_recorded(self, executor):
        executor._run_git = lambda *args: MagicMock(returncode=1)
        executor._commit_step = lambda *args: None
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")
        fake = _FakeClaude(executor, step_num=2, side_effects=[("completed", "done")])
        executor._invoke_claude = fake
        executor._execute_all_steps("GUARD")
        idx = ex.StepExecutor._read_json(executor._index_file)
        s2 = next(s for s in idx["steps"] if s["step"] == 2)
        assert "started_at" in s2

    def test_all_completed_terminates(self, executor):
        idx = ex.StepExecutor._read_json(executor._index_file)
        for s in idx["steps"]:
            s["status"] = "completed"
            s.setdefault("summary", "ok")
        ex.StepExecutor._write_json(executor._index_file, idx)
        called = {"n": 0}

        def boom(*args, **kwargs):
            called["n"] += 1
            raise AssertionError("should not be called")

        executor._invoke_claude = boom
        executor._execute_all_steps("GUARD")
        assert called["n"] == 0


# ---------------------------------------------------------------------------
# F-3. HARNESS_MODE / 환경변수 sanitize
# ---------------------------------------------------------------------------

class TestHarnessModeInjection:
    def test_harness_mode_env_passed_to_claude(self, executor):
        env = executor._sanitized_env()
        assert env["HARNESS_MODE"] == "1"

    def test_api_keys_stripped_from_env(self, executor, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "secret-gemini")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "secret-claude")
        monkeypatch.setenv("YOUTUBE_API_KEY", "secret-yt")
        monkeypatch.setenv("OTHER_VAR", "ok")
        env = executor._sanitized_env()
        assert "GEMINI_API_KEY" not in env
        assert "ANTHROPIC_API_KEY" not in env
        assert "YOUTUBE_API_KEY" not in env
        assert env.get("OTHER_VAR") == "ok"
        assert env["HARNESS_MODE"] == "1"

    def test_invoke_claude_uses_sanitized_env(self, executor, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "secret")
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_claude({"step": 2, "name": "ui"}, "preamble")
        env_passed = mock_run.call_args[1]["env"]
        assert env_passed["HARNESS_MODE"] == "1"
        assert "GEMINI_API_KEY" not in env_passed


# ---------------------------------------------------------------------------
# F-4. retry 시 stderr tail 피드백 (A-1)
# ---------------------------------------------------------------------------

class TestRetryFeedback:
    def test_read_output_tail_returns_stderr(self, executor):
        out = executor._phase_dir / "step2-output.json"
        out.write_text(json.dumps({"stderr": "line1\nline2", "stdout": "ok"}), encoding="utf-8")
        result = executor._read_output_tail(out)
        assert "line1\nline2" in result

    def test_read_output_tail_falls_back_to_stdout(self, executor):
        out = executor._phase_dir / "step2-output.json"
        out.write_text(json.dumps({"stderr": "", "stdout": "build success"}), encoding="utf-8")
        result = executor._read_output_tail(out)
        assert "build success" in result

    def test_tail_truncates_to_max(self, executor):
        out = executor._phase_dir / "step2-output.json"
        long_stderr = "x" * 5000
        out.write_text(json.dumps({"stderr": long_stderr, "stdout": ""}), encoding="utf-8")
        result = executor._read_output_tail(out)
        assert "앞부분 생략" in result
        body = result.split("\n", 1)[1]
        assert len(body) == ex.StepExecutor.RETRY_TAIL_CHARS

    def test_missing_output_returns_placeholder(self, executor):
        result = executor._read_output_tail(executor._phase_dir / "step99-output.json")
        assert result == "(직전 출력 없음)"


# ---------------------------------------------------------------------------
# F-5. dry-run / from-step / step timeout
# ---------------------------------------------------------------------------

class TestDryRunAndFromStep:
    def test_dry_run_skips_claude(self, executor, capsys):
        executor._dry_run = True
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")
        out = executor._invoke_claude({"step": 2, "name": "ui"}, "PREAMBLE")
        assert out["dryRun"] is True
        captured = capsys.readouterr()
        assert "DRY RUN" in captured.out

    def test_from_step_marks_earlier_as_completed(self, executor):
        executor._from_step = 2
        executor._apply_from_step_override()
        idx = ex.StepExecutor._read_json(executor._index_file)
        assert idx["steps"][0]["status"] == "completed"
        assert idx["steps"][1]["status"] == "completed"

    def test_step_timeout_default(self, executor):
        assert executor._step_timeout({"step": 0, "name": "a"}) == 1800

    def test_step_timeout_override(self, executor):
        assert executor._step_timeout({"step": 0, "name": "a", "timeout_seconds": 3600}) == 3600


# ---------------------------------------------------------------------------
# F-6. _run_build_gate (C-2)
# ---------------------------------------------------------------------------

class TestBuildGate:
    def test_skip_when_no_package_json(self, executor, tmp_project, capsys):
        with patch.object(ex, "ROOT", tmp_project):
            executor._run_build_gate()
        captured = capsys.readouterr()
        assert "skip build gate" in captured.out

    def test_runs_lint_build_test(self, executor, tmp_project, monkeypatch):
        (tmp_project / "package.json").write_text("{}", encoding="utf-8")
        calls: list = []

        class FakePopen:
            def __init__(self, cmd, **kwargs):
                calls.append(cmd)
                self.stdout = io.StringIO("")
                self.returncode = 0

            def wait(self):
                return 0

        monkeypatch.setattr("subprocess.Popen", FakePopen)
        with patch.object(ex, "ROOT", tmp_project):
            executor._run_build_gate()
        assert calls == [["npm", "run", "lint"], ["npm", "run", "build"], ["npm", "run", "test"]]

    def test_failure_exits_1(self, executor, tmp_project, monkeypatch):
        (tmp_project / "package.json").write_text("{}", encoding="utf-8")

        class FakePopen:
            def __init__(self, cmd, **kwargs):
                self.stdout = io.StringIO("")
                self.returncode = 1

            def wait(self):
                return 1

        monkeypatch.setattr("subprocess.Popen", FakePopen)
        executor._update_top_index = lambda status: None
        with patch.object(ex, "ROOT", tmp_project):
            with pytest.raises(SystemExit) as exc_info:
                executor._run_build_gate()
        assert exc_info.value.code == 1

    def test_creates_build_log_file(self, executor, tmp_project, monkeypatch):
        """phase 종료 시 .artifacts/reviews/{date}-{phase}-build.log 생성 검증."""
        (tmp_project / "package.json").write_text("{}", encoding="utf-8")

        class FakePopen:
            def __init__(self, cmd, **kwargs):
                self.stdout = io.StringIO(f"output of {' '.join(cmd)}\n")
                self.returncode = 0

            def wait(self):
                return 0

        monkeypatch.setattr("subprocess.Popen", FakePopen)
        with patch.object(ex, "ROOT", tmp_project):
            executor._run_build_gate()

        log_dir = tmp_project / ".artifacts" / "reviews"
        logs = list(log_dir.glob(f"*-{executor._phase_name}-build.log"))
        assert len(logs) == 1, f"build.log not found in {log_dir}"
        content = logs[0].read_text(encoding="utf-8")
        assert "npm run lint" in content
        assert "npm run build" in content
        assert "npm run test" in content
        assert "Build gate passed" in content


# ---------------------------------------------------------------------------
# F-7. dry-run 가드 — git/index 변경 0건 보장 (검증 8-B 사후 fix)
# ---------------------------------------------------------------------------

class TestDryRunGuards:
    def test_dry_run_run_skips_checkout_and_finalize(self, executor):
        """dry-run에서 run() 호출 시 _checkout_branch, _commit_step, _finalize 모두 미호출."""
        executor._dry_run = True
        called: dict = {"checkout": 0, "commit": 0, "finalize": 0, "build_gate": 0,
                        "check_tree": 0, "ensure_created": 0, "apply_from_step": 0}

        def track(key):
            def inner(*args, **kwargs):
                called[key] += 1
            return inner

        executor._checkout_branch = track("checkout")
        executor._commit_step = track("commit")
        executor._finalize = track("finalize")
        executor._run_build_gate = track("build_gate")
        executor._check_working_tree = track("check_tree")
        executor._ensure_created_at = track("ensure_created")
        executor._apply_from_step_override = track("apply_from_step")
        executor._check_claude_cli = lambda: None
        executor._check_blockers = lambda: None
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")

        executor.run()

        assert called["checkout"] == 0, "dry-run에서 _checkout_branch가 호출되면 안 됨"
        assert called["commit"] == 0, "dry-run에서 _commit_step이 호출되면 안 됨"
        assert called["finalize"] == 0, "dry-run에서 _finalize가 호출되면 안 됨"
        assert called["build_gate"] == 0
        assert called["check_tree"] == 0, "dry-run에선 dirty 5초 대기 skip"
        assert called["ensure_created"] == 0, "dry-run에선 index.json created_at 기록 skip"
        assert called["apply_from_step"] == 0

    def test_dry_run_does_not_mutate_index(self, executor):
        """dry-run 실행 전후로 phases/{phase}/index.json이 동일해야 한다."""
        executor._dry_run = True
        executor._check_claude_cli = lambda: None
        executor._check_blockers = lambda: None
        (executor._phase_dir / "step2.md").write_text("dummy", encoding="utf-8")

        before = executor._index_file.read_text(encoding="utf-8")
        executor.run()
        after = executor._index_file.read_text(encoding="utf-8")
        assert before == after, "dry-run이 index.json을 변경했음"

    def test_dry_run_outputs_each_pending_step(self, executor, capsys):
        """dry-run은 pending step의 preamble을 한 번씩 출력한다."""
        executor._dry_run = True
        executor._check_claude_cli = lambda: None
        executor._check_blockers = lambda: None
        (executor._phase_dir / "step2.md").write_text("UI 작업", encoding="utf-8")

        executor.run()
        captured = capsys.readouterr()
        # fixture에 step 2만 pending → 1회 DRY RUN 출력 + 종료 메시지
        assert captured.out.count("DRY RUN preamble") == 1
        assert "어떤 부작용도 없습니다" in captured.out
