#!/usr/bin/env python3
"""
Harness Step Executor — phase 내 step을 순차 실행하고 자가 교정한다.

Usage:
    python scripts/execute.py <phase-dir> [--push] [--verbose] [--dry-run] [--from-step N]
"""

import argparse
import contextlib
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import types
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent


@contextlib.contextmanager
def progress_indicator(label: str):
    """터미널 진행 표시기. with 문으로 사용하며 .elapsed 로 경과 시간을 읽는다."""
    frames = "◐◓◑◒"
    stop = threading.Event()
    t0 = time.monotonic()

    def _animate():
        idx = 0
        while not stop.wait(0.12):
            sec = int(time.monotonic() - t0)
            sys.stderr.write(f"\r{frames[idx % len(frames)]} {label} [{sec}s]")
            sys.stderr.flush()
            idx += 1
        sys.stderr.write("\r" + " " * (len(label) + 20) + "\r")
        sys.stderr.flush()

    th = threading.Thread(target=_animate, daemon=True)
    th.start()
    info = types.SimpleNamespace(elapsed=0.0)
    try:
        yield info
    finally:
        stop.set()
        th.join()
        info.elapsed = time.monotonic() - t0


class StepExecutor:
    """Phase 디렉토리 안의 step들을 순차 실행하는 하네스."""

    MAX_RETRIES = 3
    RETRY_TAIL_CHARS = 4000  # retry 프롬프트에 포함시킬 직전 출력 tail 크기
    DEFAULT_TIMEOUT = 1800   # claude -p subprocess 디폴트 timeout (초)
    SENSITIVE_ENV_KEYS = ("GEMINI_API_KEY", "ANTHROPIC_API_KEY", "YOUTUBE_API_KEY")
    AUTH_FAIL_HINTS = ("not authenticated", "please login", "authentication failed", "auth required")
    FEAT_MSG = "feat({phase}): step {num} — {name}"
    FIX_MSG = "fix({phase}): step {num} — {name}"  # phase-review step 전용 (의미 명확성)
    CHORE_MSG = "chore({phase}): step {num} output"
    REVIEW_STEP_NAME = "phase-review"
    TZ = timezone(timedelta(hours=9))

    def __init__(
        self,
        phase_dir_name: str,
        *,
        auto_push: bool = False,
        verbose: bool = False,
        dry_run: bool = False,
        from_step: Optional[int] = None,
    ):
        self._root = str(ROOT)
        self._phases_dir = ROOT / "phases"
        self._phase_dir = self._phases_dir / phase_dir_name
        self._phase_dir_name = phase_dir_name
        self._top_index_file = self._phases_dir / "index.json"
        self._auto_push = auto_push
        self._verbose = verbose
        self._dry_run = dry_run
        self._from_step = from_step

        if not self._phase_dir.is_dir():
            print(f"ERROR: {self._phase_dir.as_posix()} not found")
            sys.exit(1)

        self._index_file = self._phase_dir / "index.json"
        if not self._index_file.exists():
            print(f"ERROR: {self._index_file.as_posix()} not found")
            sys.exit(1)

        idx = self._read_json(self._index_file)
        self._project = idx.get("project", "project")
        self._phase_name = idx.get("phase", phase_dir_name)
        self._total = len(idx["steps"])

    def run(self):
        self._print_header()
        self._check_claude_cli()
        self._check_blockers()
        # dry-run은 절대 git/index.json을 변경하지 않는다. checkout/dirty 검사/index 기록 모두 skip.
        if not self._dry_run:
            self._check_working_tree()
            self._checkout_branch()
            self._ensure_created_at()
            self._apply_from_step_override()
        guardrails = self._load_guardrails()
        if self._dry_run:
            self._dry_run_all_steps(guardrails)
            return
        self._execute_all_steps(guardrails)
        self._finalize()

    # --- 사전 검증 ---

    def _check_claude_cli(self):
        """claude CLI 실행 파일 존재 확인. dry-run 모드는 우회."""
        if self._dry_run:
            return
        if shutil.which("claude") is None:
            print("  ERROR: claude CLI가 발견되지 않았습니다 (PATH).")
            print("  Install: npm i -g @anthropic-ai/claude-code")
            print("  Login:   claude auth")
            sys.exit(1)

    def _check_working_tree(self):
        """현재 브랜치가 dirty면 경고. 무관 변경이 feat-{phase}로 섞이는 사고 방지."""
        r = self._run_git("status", "--porcelain")
        if r.returncode != 0:
            return  # git repo가 아닌 경우 _checkout_branch가 처리
        if r.stdout.strip():
            print("  WARN: working tree에 미커밋 변경사항이 있습니다 — 그대로 진행 시 feat 브랜치에 섞일 수 있습니다.")
            print("  Hint: 'git stash' 후 다시 실행하거나 무관 변경을 별도 커밋하세요.")
            print("  계속 진행합니다(5초 대기)...")
            try:
                time.sleep(5)
            except KeyboardInterrupt:
                print("\n  중단됨")
                sys.exit(130)

    def _apply_from_step_override(self):
        """--from-step N: step < N을 메모리상 completed로 간주 (index.json은 건드리지 않음).
        디버깅 / 부분 재실행 용도. 영구 변경이 아님."""
        if self._from_step is None:
            return
        index = self._read_json(self._index_file)
        changed = False
        for s in index["steps"]:
            if s["step"] < self._from_step and s["status"] != "completed":
                s["status"] = "completed"
                s.setdefault("summary", "(--from-step override)")
                changed = True
        if changed:
            self._write_json(self._index_file, index)
            print(f"  --from-step {self._from_step}: step < {self._from_step}을(를) completed로 마크")

    # --- timestamps ---

    def _stamp(self) -> str:
        return datetime.now(self.TZ).strftime("%Y-%m-%dT%H:%M:%S%z")

    # --- JSON I/O ---

    @staticmethod
    def _read_json(p: Path) -> dict:
        return json.loads(p.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(p: Path, data: dict):
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- git ---

    def _run_git(self, *args) -> subprocess.CompletedProcess:
        cmd = ["git"] + list(args)
        return subprocess.run(
            cmd, cwd=self._root, capture_output=True, text=True,
            encoding="utf-8", errors="replace",
        )

    def _checkout_branch(self):
        branch = f"feat-{self._phase_name}"

        r = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        if r.returncode != 0:
            print(f"  ERROR: git을 사용할 수 없거나 git repo가 아닙니다.")
            print(f"  {r.stderr.strip()}")
            sys.exit(1)

        if r.stdout.strip() == branch:
            return

        r = self._run_git("rev-parse", "--verify", branch)
        r = self._run_git("checkout", branch) if r.returncode == 0 else self._run_git("checkout", "-b", branch)

        if r.returncode != 0:
            print(f"  ERROR: 브랜치 '{branch}' checkout 실패.")
            print(f"  {r.stderr.strip()}")
            print(f"  Hint: 변경사항을 stash하거나 commit한 후 다시 시도하세요.")
            sys.exit(1)

        print(f"  Branch: {branch}")

    def _commit_step(self, step_num: int, step_name: str):
        output_rel = f"phases/{self._phase_dir_name}/step{step_num}-output.json"
        index_rel = f"phases/{self._phase_dir_name}/index.json"

        self._run_git("add", "-A")
        self._run_git("reset", "HEAD", "--", output_rel)
        self._run_git("reset", "HEAD", "--", index_rel)

        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            template = self.FIX_MSG if step_name == self.REVIEW_STEP_NAME else self.FEAT_MSG
            msg = template.format(phase=self._phase_name, num=step_num, name=step_name)
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  Commit: {msg}")
            else:
                print(f"  WARN: 코드 커밋 실패: {r.stderr.strip()}")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.CHORE_MSG.format(phase=self._phase_name, num=step_num)
            r = self._run_git("commit", "-m", msg)
            if r.returncode != 0:
                print(f"  WARN: housekeeping 커밋 실패: {r.stderr.strip()}")

    # --- top-level index ---

    def _update_top_index(self, status: str):
        if not self._top_index_file.exists():
            return
        top = self._read_json(self._top_index_file)
        ts = self._stamp()
        for phase in top.get("phases", []):
            if phase.get("dir") == self._phase_dir_name:
                phase["status"] = status
                ts_key = {"completed": "completed_at", "error": "failed_at", "blocked": "blocked_at"}.get(status)
                if ts_key:
                    phase[ts_key] = ts
                break
        self._write_json(self._top_index_file, top)

    # --- guardrails & context ---

    def _load_guardrails(self) -> str:
        sections = []
        claude_md = ROOT / "CLAUDE.md"
        if claude_md.exists():
            sections.append(f"## 프로젝트 규칙 (CLAUDE.md)\n\n{claude_md.read_text(encoding='utf-8')}")
        docs_dir = ROOT / "docs"
        if docs_dir.is_dir():
            for doc in sorted(docs_dir.glob("*.md")):
                sections.append(f"## {doc.stem}\n\n{doc.read_text(encoding='utf-8')}")
        return "\n\n---\n\n".join(sections) if sections else ""

    @staticmethod
    def _build_step_context(index: dict) -> str:
        lines = [
            f"- Step {s['step']} ({s['name']}): {s['summary']}"
            for s in index["steps"]
            if s["status"] == "completed" and s.get("summary")
        ]
        if not lines:
            return ""
        return "## 이전 Step 산출물\n\n" + "\n".join(lines) + "\n\n"

    def _build_preamble(self, guardrails: str, step_context: str,
                        prev_error: Optional[str] = None) -> str:
        commit_example = self.FEAT_MSG.format(
            phase=self._phase_name, num="N", name="<step-name>"
        )
        retry_section = ""
        if prev_error:
            retry_section = (
                f"\n## ⚠ 이전 시도 실패 — 아래 에러를 반드시 참고하여 수정하라\n\n"
                f"{prev_error}\n\n---\n\n"
            )
        return (
            f"당신은 {self._project} 프로젝트의 개발자입니다. 아래 step을 수행하세요.\n\n"
            f"{guardrails}\n\n---\n\n"
            f"{step_context}{retry_section}"
            f"## 작업 규칙\n\n"
            f"1. 이전 step에서 작성된 코드를 확인하고 일관성을 유지하라.\n"
            f"2. 이 step에 명시된 작업만 수행하라. 추가 기능이나 파일을 만들지 마라.\n"
            f"3. 기존 테스트를 깨뜨리지 마라.\n"
            f"4. AC(Acceptance Criteria) 검증을 직접 실행하라.\n"
            f"5. /phases/{self._phase_dir_name}/index.json의 해당 step status를 업데이트하라:\n"
            f"   - AC 통과 → \"completed\" + \"summary\" 필드에 이 step의 산출물을 한 줄로 요약\n"
            f"   - {self.MAX_RETRIES}회 수정 시도 후에도 실패 → \"error\" + \"error_message\" 기록\n"
            f"   - 사용자 개입이 필요한 경우 (API 키, 인증, 수동 설정 등) → \"blocked\" + \"blocked_reason\" 기록 후 즉시 중단\n"
            f"6. 모든 변경사항을 커밋하라:\n"
            f"   {commit_example}\n\n---\n\n"
        )

    # --- Claude 호출 ---

    def _sanitized_env(self) -> dict:
        """claude CLI 호출용 환경변수 — 민감 API 키는 스트립.
        HARNESS_MODE=1 주입으로 글로벌 [Impact Review]/post-edit lint hook 우회.
        PreToolUse[Bash] 보안 hook은 그대로 유지된다."""
        env = {k: v for k, v in os.environ.items() if k not in self.SENSITIVE_ENV_KEYS}
        env["HARNESS_MODE"] = "1"
        return env

    def _step_timeout(self, step: dict) -> int:
        """step에 timeout_seconds 옵션 필드가 있으면 사용, 없으면 디폴트."""
        return int(step.get("timeout_seconds") or self.DEFAULT_TIMEOUT)

    def _read_output_tail(self, output_path: Path) -> str:
        """직전 step{N}-output.json의 stderr(우선) 또는 stdout 마지막 RETRY_TAIL_CHARS 문자.
        retry 프롬프트에 LLM 피드백으로 결합된다."""
        if not output_path.exists():
            return "(직전 출력 없음)"
        try:
            data = json.loads(output_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return "(직전 출력 파싱 실패)"
        text = (data.get("stderr") or "").strip() or (data.get("stdout") or "").strip()
        if not text:
            return "(직전 출력 비어 있음)"
        if len(text) > self.RETRY_TAIL_CHARS:
            text = "...(앞부분 생략)...\n" + text[-self.RETRY_TAIL_CHARS:]
        return text

    def _invoke_claude(self, step: dict, preamble: str) -> dict:
        step_num, step_name = step["step"], step["name"]
        step_file = self._phase_dir / f"step{step_num}.md"

        if not step_file.exists():
            print(f"  ERROR: {step_file.as_posix()} not found")
            sys.exit(1)

        prompt = preamble + step_file.read_text(encoding="utf-8")
        out_path = self._phase_dir / f"step{step_num}-output.json"

        # dry-run: claude 호출 없이 프롬프트만 출력
        if self._dry_run:
            print(f"\n--- DRY RUN preamble + step{step_num}.md ({len(prompt)} chars) ---")
            print(prompt)
            print("--- END DRY RUN ---\n")
            output = {"step": step_num, "name": step_name, "exitCode": 0,
                      "stdout": "(dry-run)", "stderr": "", "dryRun": True}
            out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
            return output

        # prompt를 stdin으로 전달 — Windows CreateProcess 명령줄 길이 한계(32KB) 회피
        cmd = ["claude", "-p", "--dangerously-skip-permissions", "--output-format", "json"]
        env = self._sanitized_env()
        timeout = self._step_timeout(step)

        if self._verbose:
            result = self._run_with_stream(cmd, env, timeout, stdin_input=prompt)
        else:
            result = subprocess.run(cmd, cwd=self._root, capture_output=True, text=True,
                                    timeout=timeout, env=env,
                                    encoding="utf-8", errors="replace",
                                    input=prompt)

        if result.returncode != 0:
            print(f"\n  WARN: Claude가 비정상 종료됨 (code {result.returncode})")
            stderr_snip = (result.stderr or "")[:500]
            if stderr_snip:
                print(f"  stderr: {stderr_snip}")
            if any(hint in (result.stderr or "").lower() for hint in self.AUTH_FAIL_HINTS):
                print("  HINT: claude CLI 인증이 필요합니다 → 별도 터미널에서 `claude auth` 실행 후 재시도.")

        output = {
            "step": step_num, "name": step_name,
            "exitCode": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
        }
        out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
        return output

    def _run_with_stream(self, cmd: list, env: dict, timeout: int, stdin_input: str = None):
        """verbose 모드: stderr/stdout를 줄 단위로 터미널에 흘려보내며 동시에 버퍼링.
        progress_indicator의 spinner를 덮지 않도록 줄바꿈 prefix 사용."""
        proc = subprocess.Popen(cmd, cwd=self._root, env=env,
                                stdin=subprocess.PIPE if stdin_input is not None else None,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, bufsize=1,
                                encoding="utf-8", errors="replace")
        if stdin_input is not None:
            proc.stdin.write(stdin_input)
            proc.stdin.close()
        stdout_buf: list = []
        stderr_buf: list = []

        def _drain(stream, buf, prefix):
            for line in iter(stream.readline, ""):
                buf.append(line)
                sys.stderr.write(f"\n  {prefix} {line}")
                sys.stderr.flush()
            stream.close()

        t_out = threading.Thread(target=_drain, args=(proc.stdout, stdout_buf, "[out]"), daemon=True)
        t_err = threading.Thread(target=_drain, args=(proc.stderr, stderr_buf, "[err]"), daemon=True)
        t_out.start(); t_err.start()

        try:
            rc = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            t_out.join(); t_err.join()
            raise

        t_out.join(); t_err.join()
        return types.SimpleNamespace(returncode=rc, stdout="".join(stdout_buf), stderr="".join(stderr_buf))

    # --- 헤더 & 검증 ---

    def _print_header(self):
        print(f"\n{'='*60}")
        print(f"  Harness Step Executor")
        print(f"  Phase: {self._phase_name} | Steps: {self._total}")
        if self._auto_push:
            print(f"  Auto-push: enabled")
        print(f"{'='*60}")

    def _check_blockers(self):
        index = self._read_json(self._index_file)
        for s in reversed(index["steps"]):
            if s["status"] == "error":
                print(f"\n  ✗ Step {s['step']} ({s['name']}) failed.")
                print(f"  Error: {s.get('error_message', 'unknown')}")
                print(f"  Fix and reset status to 'pending' to retry.")
                sys.exit(1)
            if s["status"] == "blocked":
                print(f"\n  ⏸ Step {s['step']} ({s['name']}) blocked.")
                print(f"  Reason: {s.get('blocked_reason', 'unknown')}")
                print(f"  Resolve and reset status to 'pending' to retry.")
                sys.exit(2)
            if s["status"] != "pending":
                break

    def _ensure_created_at(self):
        index = self._read_json(self._index_file)
        if "created_at" not in index:
            index["created_at"] = self._stamp()
            self._write_json(self._index_file, index)

    # --- 실행 루프 ---

    def _execute_single_step(self, step: dict, guardrails: str) -> bool:
        """단일 step 실행 (재시도 포함). 완료되면 True, 실패/차단이면 False."""
        step_num, step_name = step["step"], step["name"]
        done = sum(1 for s in self._read_json(self._index_file)["steps"] if s["status"] == "completed")
        prev_error = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            index = self._read_json(self._index_file)
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, prev_error)

            tag = f"Step {step_num}/{self._total - 1} ({done} done): {step_name}"
            if attempt > 1:
                tag += f" [retry {attempt}/{self.MAX_RETRIES}]"

            with progress_indicator(tag) as pi:
                self._invoke_claude(step, preamble)
                elapsed = int(pi.elapsed)

            index = self._read_json(self._index_file)
            status = next((s.get("status", "pending") for s in index["steps"] if s["step"] == step_num), "pending")
            ts = self._stamp()

            if status == "completed":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["completed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✓ Step {step_num}: {step_name} [{elapsed}s]")
                return True

            if status == "blocked":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["blocked_at"] = ts
                self._write_json(self._index_file, index)
                reason = next((s.get("blocked_reason", "") for s in index["steps"] if s["step"] == step_num), "")
                print(f"  ⏸ Step {step_num}: {step_name} blocked [{elapsed}s]")
                print(f"    Reason: {reason}")
                self._update_top_index("blocked")
                sys.exit(2)

            err_msg = next(
                (s.get("error_message", "Step did not update status") for s in index["steps"] if s["step"] == step_num),
                "Step did not update status",
            )

            if attempt < self.MAX_RETRIES:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "pending"
                        s.pop("error_message", None)
                self._write_json(self._index_file, index)
                tail = self._read_output_tail(self._phase_dir / f"step{step_num}-output.json")
                prev_error = (
                    f"{err_msg}\n\n## 직전 실행 출력 (tail ≤{self.RETRY_TAIL_CHARS} chars)\n\n{tail}"
                )
                print(f"  ↻ Step {step_num}: retry {attempt}/{self.MAX_RETRIES} — {err_msg}")
            else:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "error"
                        s["error_message"] = f"[{self.MAX_RETRIES}회 시도 후 실패] {err_msg}"
                        s["failed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✗ Step {step_num}: {step_name} failed after {self.MAX_RETRIES} attempts [{elapsed}s]")
                print(f"    Error: {err_msg}")
                self._update_top_index("error")
                sys.exit(1)

        return False  # unreachable

    def _dry_run_all_steps(self, guardrails: str):
        """dry-run 전용 루프 — pending step의 preamble을 한 번씩 출력만 한다.
        index.json status 변경, git commit/checkout, retry, build gate 모두 skip.
        프롬프트 길이/구조를 검증할 때 안전하게 부작용 0건으로 호출 가능."""
        index = self._read_json(self._index_file)
        for step in index["steps"]:
            if step["status"] != "pending":
                continue
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, prev_error=None)
            self._invoke_claude(step, preamble)  # _invoke_claude 내부의 dry-run 분기로 진입
        print(f"\n{'='*60}")
        print(f"  Dry-run finished — 어떤 부작용도 없습니다 (git/index 변경 0건)")
        print(f"{'='*60}")

    def _execute_all_steps(self, guardrails: str):
        while True:
            index = self._read_json(self._index_file)
            pending = next((s for s in index["steps"] if s["status"] == "pending"), None)
            if pending is None:
                print("\n  All steps completed!")
                return

            step_num = pending["step"]
            for s in index["steps"]:
                if s["step"] == step_num and "started_at" not in s:
                    s["started_at"] = self._stamp()
                    self._write_json(self._index_file, index)
                    break

            self._execute_single_step(pending, guardrails)

    def _finalize(self):
        index = self._read_json(self._index_file)
        index["completed_at"] = self._stamp()
        self._write_json(self._index_file, index)
        self._update_top_index("completed")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = f"chore({self._phase_name}): mark phase completed"
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  ✓ {msg}")

        # 빌드 게이트: phase 종료 시 lint+build+test 1회 (.claude/settings.json Stop hook이
        # HARNESS_MODE=1 가드로 sub-session에서는 skip하므로, 진짜 게이트는 여기서 한 번).
        # phase-review step의 AC와 동일 명령이라 명목상 중복이나, 의도된 안전망:
        # (1) phase-review를 두지 않은 phase에서도 게이트 보장, (2) fix 후 최종 검증 한 번,
        # (3) npm/vitest cache hit으로 재실행 비용은 ~수초 (lint/build/test 모두 incremental).
        if not self._dry_run:
            self._run_build_gate()

        if self._auto_push:
            branch = f"feat-{self._phase_name}"
            r = self._run_git("push", "-u", "origin", branch)
            if r.returncode != 0:
                print(f"\n  ERROR: git push 실패: {r.stderr.strip()}")
                sys.exit(1)
            print(f"  ✓ Pushed to origin/{branch}")

        print(f"\n{'='*60}")
        print(f"  Phase '{self._phase_name}' completed!")
        print(f"{'='*60}")

    def _run_build_gate(self):
        """phase 종료 시 npm run lint/build/test 게이트. package.json 부재 시 skip.
        실패 시 top index를 error로 마크하고 exit 1 (연쇄 모드 안전).
        stdout/stderr를 콘솔에 흘리면서 .artifacts/reviews/{date}-{phase}-build.log에 동시 기록 (tee).
        review.md 4-A의 -build.log 명명 규약과 일치."""
        if not (ROOT / "package.json").exists():
            print("  skip build gate: no package.json yet")
            return

        log_dir = ROOT / ".artifacts" / "reviews"
        log_dir.mkdir(parents=True, exist_ok=True)
        date_str = datetime.now(self.TZ).strftime("%Y-%m-%d")
        log_path = log_dir / f"{date_str}-{self._phase_name}-build.log"

        with log_path.open("w", encoding="utf-8") as log_f:
            log_f.write(f"# build gate — {self._phase_name} @ {self._stamp()}\n")
            for cmd in (["npm", "run", "lint"], ["npm", "run", "build"], ["npm", "run", "test"]):
                header = f"  → {' '.join(cmd)}"
                print(header)
                log_f.write(f"\n## {' '.join(cmd)}\n")
                log_f.flush()

                # encoding 명시: npm/vitest 출력에 한글 테스트 이름이 섞일 때 cp949 디코딩 실패 회피
                # stderr를 stdout으로 합쳐서 단일 스트림 tee
                proc = subprocess.Popen(
                    cmd, cwd=self._root, shell=False,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1,
                    encoding="utf-8", errors="replace",
                )
                assert proc.stdout is not None
                for line in iter(proc.stdout.readline, ""):
                    sys.stdout.write(line)
                    sys.stdout.flush()
                    log_f.write(line)
                    log_f.flush()
                proc.stdout.close()
                rc = proc.wait()

                if rc != 0:
                    fail_msg = f"\n  ✗ Build gate failed: {' '.join(cmd)} (exit {rc})"
                    print(fail_msg)
                    log_f.write(fail_msg + "\n")
                    log_f.write(f"  log: {log_path.as_posix()}\n")
                    self._update_top_index("error")
                    sys.exit(1)
            log_f.write("\n  ✓ Build gate passed (lint + build + test)\n")
        print(f"  ✓ Build gate passed (lint + build + test) — log: {log_path.as_posix()}")


def main():
    # Windows cp949 콘솔에서도 한글/em dash가 깨지지 않도록 utf-8 강제
    for stream in (sys.stdout, sys.stderr):
        with contextlib.suppress(AttributeError, OSError):
            stream.reconfigure(encoding="utf-8")
    # 자식 Python 프로세스에도 UTF-8 모드 전파 (cp949 환경 안전망)
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    os.environ.setdefault("PYTHONUTF8", "1")

    parser = argparse.ArgumentParser(description="Harness Step Executor")
    parser.add_argument("phase_dir", help="Phase directory name (e.g. 0-mvp)")
    parser.add_argument("--push", action="store_true", help="Push branch after completion")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="claude CLI의 stdout/stderr를 실시간으로 흘려보냄 (디버깅용)")
    parser.add_argument("--dry-run", action="store_true",
                        help="claude CLI 호출 없이 preamble + step.md를 출력만 함 (프롬프트 검증용)")
    parser.add_argument("--from-step", type=int, metavar="N",
                        help="step < N을 메모리상 completed로 간주하고 N부터 실행 (영구 변경 아님)")
    args = parser.parse_args()

    StepExecutor(
        args.phase_dir,
        auto_push=args.push,
        verbose=args.verbose,
        dry_run=args.dry_run,
        from_step=args.from_step,
    ).run()


if __name__ == "__main__":
    main()
