#!/usr/bin/env python3
"""
PreToolUse hook (Bash 매처): 위험 명령을 사전 차단한다.

Claude Code는 stdin으로 다음 형식의 JSON을 전달한다:
  {"tool_name": "Bash", "tool_input": {"command": "..."}, ...}

종료 코드 2 + stderr 출력으로 차단되며, 메시지는 사용자에게 그대로 표시된다.
종료 코드 0이면 명령이 정상 실행된다.
"""
import json
import re
import sys

# (정규식, 사람이 읽을 라벨)
PATTERNS = [
    # rm -rf, rm -r -f, rm -fr, rm --recursive --force 등
    (r'\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*[fF][a-zA-Z]*|-[a-zA-Z]*[fF][a-zA-Z]*[rR][a-zA-Z]*|--recursive\s+--force|--force\s+--recursive)', 'rm -rf'),
    # git push --force / -f. --force-with-lease는 안전하므로 허용
    (r'\bgit\s+push\s+(?:--force(?!-with-lease)|-f)\b', 'git push --force'),
    (r'\bgit\s+reset\s+--hard\b', 'git reset --hard'),
    (r'\bgit\s+clean\s+-[a-zA-Z]*[fF]', 'git clean -f'),
    # 대문자 -D만 차단 (소문자 -d는 머지된 브랜치만 삭제하므로 안전 — IGNORECASE 우회)
    (r'\bgit\s+branch\s+(?-i:-D)\b', 'git branch -D'),
    (r'\bDROP\s+TABLE\b', 'DROP TABLE'),
    # .env 파일 덮어쓰기 차단 (echo "" > .env.local 같은 패턴)
    (r'>\s*\.env(?:\.|\s|$)', '> .env redirect'),
    # 환경변수 파일 stdout 노출 차단 (cat .env, cat .env.local 등)
    # negative lookbehind로 .env.example / .env.template / .env.sample 등 안전 템플릿 변형은 화이트리스트 통과
    # (Python re는 분리 lookbehind 각각 길이가 고정이면 OK)
    (r'\bcat\s+[^|;&]*\.env(?:\.[A-Za-z0-9_-]+)*(?<!\.example)(?<!\.template)(?<!\.sample)(?=[\s|;&]|$)', 'cat .env'),
    # npm 레지스트리 변경 차단 (악성 미러 우회)
    (r'\bnpm\s+config\s+set\s+registry\b', 'npm registry change'),
    # 과잉 권한 부여 차단
    (r'\bchmod\s+(?:-R\s+)?(?:777|666)\b', 'chmod 777/666'),
]


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    cmd = data.get("tool_input", {}).get("command", "")
    if not cmd:
        sys.exit(0)

    for pattern, label in PATTERNS:
        if re.search(pattern, cmd, re.IGNORECASE):
            print(
                f"BLOCKED: dangerous pattern '{label}' detected\n"
                f"  command: {cmd[:200]}\n"
                f"  If --force is required, consider using --force-with-lease.",
                file=sys.stderr,
            )
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
