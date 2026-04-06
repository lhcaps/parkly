#!/usr/bin/env python3
"""
i18n-safe-edit.py
=================
Safe i18n JSON editor for Parkly monorepo.

Features
--------
- VALIDATE  : Parse JSON, report exact line/col of first error (no more
              "position 70985 line 1786 col 2" mysteries).
- ADD-SECTION: Add a new top-level key at the correct position, with proper
              comma insertion. Replaces placeholder markers like __ACCOUNTS__
              with real content.
- CHECK     : Quick health check (valid JSON + top-level key presence).

Usage
-----
    python scripts/i18n-safe-edit.py validate apps/web/src/i18n/locales/en.json
    python scripts/i18n-safe-edit.py add-section apps/web/src/i18n/locales/en.json \
        --section accountPage --placeholder __ACCOUNTS__ \
        --content '{"adminTab":{"title":"..."}}'
    python scripts/i18n-safe-edit.py check apps/web/src/i18n/locales/en.json

CRLF note: Files are read and written preserving their line endings.
"""

import argparse
import json
import re
import sys
from pathlib import Path

EOL_MARKER = object()  # sentinel — keeps track of CRLF vs LF positions


# ─────────────────────────────────────────────────────────────────────────────
# JSON validation with precise source location
# ─────────────────────────────────────────────────────────────────────────────

def _build_position_to_line_col(text: str):
    """Return a list where index i = byte offset, value = (line, col) 1-indexed."""
    line_offsets = [0]  # byte offset where each line starts
    for i, ch in enumerate(text):
        if ch == '\n':
            line_offsets.append(i + 1)
    line_col = []
    cur_line = 1
    cur_col = 1
    for i in range(len(text) + 1):
        line_col.append((cur_line, cur_col))
        if i < len(text):
            if text[i] == '\n':
                cur_line += 1
                cur_col = 1
            else:
                cur_col += 1
    return line_col


def _line_col_from_offset(text: str, offset: int):
    lc = _build_position_to_line_col(text)
    if offset >= len(lc):
        return lc[-1] if lc else (1, 1)
    return lc[offset]


def validate_json(source_path: str, *, emit_sample: bool = True) -> tuple[bool, str]:
    """
    Parse a JSON file and return (ok, message).
    On error, message includes EXACT line and column of the first problem.
    """
    path = Path(source_path)
    if not path.exists():
        return False, f"FILE_NOT_FOUND: {source_path}"

    raw = path.read_bytes()
    # Normalize line endings for parsing
    text = raw.decode('utf-8', errors='replace')
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Quick trailing-comma detection BEFORE json.loads
    # Look for }, or ], at the very end of the root object
    stripped = text.rstrip()
    if stripped.endswith('},') or stripped.endswith('],'):
        # Find where the root object ends
        problem = stripped[-20:]
        return False, f"TRAILING_COMMA: last char(s) are ',}}' or ',]]' — remove the trailing comma from the root object.\n  Snippet: ...{problem!r}"

    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        line, col = _line_col_from_offset(text, e.pos)
        # Grab a snippet around the error
        lines = text.split('\n')
        snippet = ""
        if 0 <= line - 1 < len(lines):
            snippet = f"  Line {line}: {lines[line - 1]!r}"
            if line < len(lines):
                snippet += f"\n  Line {line + 1}: {lines[line]!r}"
        msg = (
            f"JSON_ERROR at {source_path}:{line}:{col}\n"
            f"  {e.msg}\n"
            f"{snippet}"
        )
        return False, msg

    # Check for top-level duplicates
    if isinstance(obj, dict):
        keys = list(obj.keys())
        if len(keys) != len(set(keys)):
            seen = {}
            for k in keys:
                seen.setdefault(k, []).append(k)
            dups = {k: v for k, v in seen.items() if len(v) > 1}
            return False, f"DUPLICATE_KEYS: {dups}"

    return True, f"OK — {len(obj) if isinstance(obj, dict) else len(obj)} top-level keys"


def _load_json_object(path: str) -> tuple[dict | None, str | None]:
    """Return (obj, None) or (None, error_message)."""
    p = Path(path)
    if not p.exists():
        return None, f"FILE_NOT_FOUND: {path}"
    text = p.read_bytes().decode('utf-8', errors='replace').replace('\r\n', '\n').replace('\r', '\n')
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        line, col = _line_col_from_offset(text, e.pos)
        return None, f"JSON_ERROR at {path}:{line}:{col} — {e.msg}"
    if not isinstance(obj, dict):
        return None, f"ROOT_MUST_BE_OBJECT: {path}"
    return obj, None


def structural_diff(a: object, b: object, path: str = '') -> list[str]:
    """
    Compare two JSON values for structural parity (types, dict keys, list lengths).
    String/number/bool/null leaves must match types; string values are not compared.
    """
    mismatches: list[str] = []
    label = path if path else '<root>'
    if type(a) is not type(b):
        mismatches.append(f"{label}: type {type(a).__name__} vs {type(b).__name__}")
        return mismatches
    if isinstance(a, dict):
        ad, bd = a, b
        ak, bk = set(ad.keys()), set(bd.keys())
        for k in sorted(ak - bk):
            mismatches.append(f"{label}.{k}: missing in second file")
        for k in sorted(bk - ak):
            mismatches.append(f"{label}.{k}: missing in first file")
        for k in sorted(ak & bk):
            sub = path + '.' + k if path else k
            mismatches.extend(structural_diff(ad[k], bd[k], sub))
    elif isinstance(a, list):
        al, bl = a, b
        if len(al) != len(bl):
            mismatches.append(f"{label}: list length {len(al)} vs {len(bl)}")
        else:
            for i, (ai, bi) in enumerate(zip(al, bl)):
                mismatches.extend(structural_diff(ai, bi, f"{path}[{i}]"))
    return mismatches


def parity_locales(path_a: str, path_b: str) -> tuple[bool, str]:
    """Ensure en.json and vi.json have identical structural shape."""
    obj_a, err_a = _load_json_object(path_a)
    if err_a:
        return False, err_a
    obj_b, err_b = _load_json_object(path_b)
    if err_b:
        return False, err_b
    diffs = structural_diff(obj_a, obj_b)
    if diffs:
        preview = '\n  '.join(diffs[:40])
        more = f"\n  ... and {len(diffs) - 40} more" if len(diffs) > 40 else ''
        return False, f"I18N_PARITY_FAILED ({len(diffs)} diff(s)):\n  {preview}{more}"
    return True, f"OK — structural parity: {path_a} <-> {path_b}"


def validate_locale_schema(locale_path: str, schema_path: str) -> tuple[bool, str]:
    """
    Validate top-level keys against i18n.locale.schema.json (required[] only).
    Full JSON Schema validation is optional (no extra pip deps in CI).
    """
    schema_p = Path(schema_path)
    if not schema_p.exists():
        return False, f"SCHEMA_NOT_FOUND: {schema_path}"
    try:
        schema = json.loads(schema_p.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        return False, f"INVALID_SCHEMA_JSON: {e}"

    required = schema.get('required')
    if not isinstance(required, list) or not all(isinstance(x, str) for x in required):
        return False, "SCHEMA_INVALID: 'required' must be an array of strings"

    ok, msg = validate_json(locale_path)
    if not ok:
        return False, msg

    obj, err = _load_json_object(locale_path)
    if err or obj is None:
        return False, err or 'parse failed'

    missing = [k for k in required if k not in obj]
    if missing:
        return False, f"SCHEMA_KEYS_MISSING in {locale_path}: {', '.join(missing)}"

    extra_type = schema.get('type')
    if extra_type == 'object' and not isinstance(obj, dict):
        return False, "SCHEMA_TYPE: root must be object"

    return True, f"OK — schema keys satisfied for {locale_path}"


def _find_placeholder_in_text(text: str, placeholder: str) -> int | None:
    """Return the byte offset of a placeholder string (no quotes)."""
    idx = text.find(placeholder)
    if idx == -1:
        return None
    # Verify it's inside a JSON value (not a key or string)
    # Simple heuristic: look backward for '"' without an intervening '}'
    before = text[:idx]
    last_quote = before.rfind('"')
    last_close = before.rfind('}')
    if last_quote > last_close:
        return idx
    return None


def _detect_eol(path: Path) -> str:
    """Detect line ending used in file."""
    raw = path.read_bytes()
    if b'\r\n' in raw[:4096]:
        return '\r\n'
    return '\n'


def _ensure_final_newline(text: str, eol: str) -> str:
    """Ensure file ends with exactly one newline."""
    text = text.rstrip('\r\n')
    return text + eol


# ─────────────────────────────────────────────────────────────────────────────
# ADD-SECTION command
# ─────────────────────────────────────────────────────────────────────────────

def add_section(
    source_path: str,
    section_key: str,
    content: str,
    *,
    placeholder: str | None = None,
) -> tuple[bool, str]:
    """
    Safely add/replace a top-level key in a JSON file.

    Supports two strategies:
    1. PLACEHOLDER: Replace __PLACEHOLDER__ with the actual section content.
       The placeholder must be on its own JSON value line, e.g.:
           "__MY_SECTION__": {}
    2. INJECT:    Append / replace the key at the correct sorted position.
       Only works if the file is valid JSON.

    Args:
        source_path : Path to the i18n JSON file.
        section_key : Top-level key to add/replace.
        content     : JSON string value for the new section.
        placeholder  : If provided, replace this exact string (without quotes).

    Returns:
        (success, message)
    """
    path = Path(source_path)
    eol = _detect_eol(path)

    # Normalize input content to a Python object
    try:
        new_value = json.loads(content)
    except json.JSONDecodeError as e:
        return False, f"INVALID content JSON: {e.msg} at pos {e.pos}"

    # ── Strategy 1: Placeholder replacement ───────────────────────────────────
    if placeholder:
        raw = path.read_bytes()
        text = raw.decode('utf-8', errors='replace')
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        ph_idx = _find_placeholder_in_text(text, placeholder)
        if ph_idx is None:
            return False, f"PLACEHOLDER_NOT_FOUND: '{placeholder}' not found in {source_path}"

        # We replace the placeholder and its JSON value wrapper.
        # Walk backward to find the opening '"' of the key
        before = text[:ph_idx]
        quote_open = before.rfind('"')
        if quote_open == -1:
            return False, f"CANT_FIND_KEY: placeholder is not inside a JSON string key"
        # Walk forward to find end of placeholder string (second '"')
        after = text[ph_idx:]
        quote_close = after.find('"', 1)
        if quote_close == -1:
            return False, f"CANT_FIND_KEY_END: unmatched quotes"
        # Extract key name
        key_match = re.search(r'"([^"]+)"\s*:\s*__' + re.escape(placeholder) + r'__', text)
        if key_match is None:
            return False, f"INVALID_PLACEHOLDER_FORMAT: expected '__PLACEHOLDER__' as a JSON value"
        key = key_match.group(1)

        # Count indentation
        line_start = text.rfind('\n', 0, quote_open) + 1
        indent = text[line_start:quote_open]
        indent_str = re.sub(r'\S', ' ', indent)  # spaces only

        # Serialize new content with same indentation
        new_content_str = json.dumps(new_value, ensure_ascii=False, indent=2)
        new_content_lines = new_content_str.split('\n')
        indented_lines = [new_content_lines[0]]
        for line in new_content_lines[1:]:
            indented_lines.append(indent_str + line)

        # Determine trailing comma (keep if file had it)
        trailing_comma = ',' if text[ph_idx + len(placeholder) + len('__'):].startswith(',') else ''
        replacement = f'{indent}"{key}": {trailing_comma}\n'.rstrip()

        # Actually, let me redo: replace the entire "__PLACEHOLDER__" value
        # Find the full line containing the placeholder
        line_start_idx = text.rfind('\n', 0, ph_idx) + 1
        line_end_idx = text.find('\n', ph_idx)
        if line_end_idx == -1:
            line_end_idx = len(text)
        placeholder_line = text[line_start_idx:line_end_idx]
        line_eol = text[line_end_idx:line_end_idx + len(eol)] if line_end_idx < len(text) else eol

        # Replace placeholder line with expanded content
        new_block_lines = []
        new_block_lines.append(f'{indent}"{key}": {trailing_comma}')
        for line in new_content_lines[1:]:
            new_block_lines.append(indent_str + line)
        new_block_str = '\n'.join(new_block_lines)

        new_text = text[:line_start_idx] + new_block_str + line_eol + text[line_end_idx + len(line_eol):]
        new_text = _ensure_final_newline(new_text, eol)

        path.write_bytes(new_text.encode('utf-8'))
        return True, f"Replaced placeholder '{placeholder}' with section '{key}'"

    # ── Strategy 2: Inject into valid JSON ────────────────────────────────────
    raw = path.read_bytes()
    text = raw.decode('utf-8', errors='replace')
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Try to parse; if invalid, report error
    ok, msg = validate_json(source_path)
    if not ok:
        # Return the validation error so the agent can fix it first
        return False, f"CANT_ADD_SECTION: JSON is invalid:\n  {msg}\n\nFix the JSON first, then retry."

    obj = json.loads(text)
    if not isinstance(obj, dict):
        return False, f"ROOT_MUST_BE_OBJECT: JSON root must be a dictionary"

    # Replace or add
    was_present = section_key in obj
    obj[section_key] = new_value

    # Serialize preserving structure
    # Use 2-space indent matching the file style
    new_str = json.dumps(obj, ensure_ascii=False, indent=2)

    # Try to preserve key ordering by re-serializing carefully
    # json.dumps doesn't guarantee order — we need to do a surgical insertion
    # Instead: parse, update, then do surgical string replacement
    #
    # More robust approach: parse the original, rebuild only the section,
    # inject it into the text
    lines = text.split('\n')

    # Find the last line of the root object (the closing brace)
    # Strategy: find "}" at depth 0 from the end
    depth = 0
    last_content_line = -1
    for i in range(len(lines) - 1, -1, -1):
        stripped = lines[i].rstrip()
        # Count { and }
        open_d = stripped.count('{')
        close_d = stripped.count('}')
        depth -= close_d
        if depth == 0 and stripped.strip().startswith('}'):
            last_content_line = i
            break
        depth += open_d

    if last_content_line == -1:
        return False, "CANT_FIND_ROOT_CLOSE: could not locate root closing brace"

    # Determine indent of last top-level key
    # Find the last top-level key line
    last_key_line = -1
    d = 0
    for i in range(last_content_line - 1, -1, -1):
        stripped = lines[i].rstrip()
        d += stripped.count('{') - stripped.count('}')
        if d == 0:
            # Check if this looks like a top-level key line
            if re.match(r'^\s*"[^"]+":', stripped):
                last_key_line = i
                break
        if d < 0:
            break

    if last_key_line == -1:
        return False, "CANT_FIND_LAST_KEY: could not determine insertion point"

    # Get indentation
    key_line = lines[last_key_line]
    indent_match = re.match(r'^(\s*)"', key_line)
    indent = indent_match.group(1) if indent_match else '  '
    has_comma = lines[last_key_line].rstrip().endswith(',')

    # Serialize new section
    new_section_str = json.dumps({section_key: new_value}, ensure_ascii=False, indent=2)
    new_section_lines = new_section_str.split('\n')

    # Build replacement lines
    new_lines = lines[:last_key_line + (1 if has_comma else 0)]
    new_lines.append(indent + new_section_lines[0])  # first line has indent
    for line in new_section_lines[1:]:
        new_lines.append(indent + line)
    new_lines.extend(lines[last_content_line:])

    new_text = eol.join(new_lines)
    if not new_text.endswith('\n'):
        new_text += eol

    path.write_bytes(new_text.encode('utf-8'))

    action = "Updated" if was_present else "Added"
    return True, f"{action} section '{section_key}' at {source_path}"


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Safe i18n JSON editor — validate, check, add sections.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/i18n-safe-edit.py validate apps/web/src/i18n/locales/en.json
  python scripts/i18n-safe-edit.py add-section apps/web/src/i18n/locales/en.json \\
      --section accountPage --content '{"adminTab":{}}' --placeholder __ACCOUNTS__
  python scripts/i18n-safe-edit.py check apps/web/src/i18n/locales/en.json
""",
    )
    sub = parser.add_subparsers(dest='command', required=True)

    # validate
    v = sub.add_parser('validate', help='Parse JSON and report exact line/col of errors')
    v.add_argument('file', help='Path to i18n JSON file')

    # add-section
    a = sub.add_parser('add-section', help='Add/replace a top-level section')
    a.add_argument('file', help='Path to i18n JSON file')
    a.add_argument('--section', required=True, help='Top-level key name')
    a.add_argument('--content', required=True, help='JSON string for the new section')
    a.add_argument('--placeholder', help='Replace this placeholder string (without quotes)')

    # check
    c = sub.add_parser('check', help='Quick health check (valid JSON + keys)')
    c.add_argument('file', help='Path to i18n JSON file')
    c.add_argument('--keys', nargs='*', help='Key names that must be present')

    pty = sub.add_parser('parity', help='Structural parity between two locale files (e.g. en vs vi)')
    pty.add_argument('file_a', help='First locale JSON')
    pty.add_argument('file_b', help='Second locale JSON')

    sv = sub.add_parser('schema-validate', help='Validate locale root keys against i18n.locale.schema.json')
    sv.add_argument('file', help='Path to i18n JSON file')
    sv.add_argument('schema', help='Path to schema JSON (required top-level keys)')

    args = parser.parse_args()

    if args.command == 'validate':
        ok, msg = validate_json(args.file)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == 'add-section':
        ok, msg = add_section(args.file, args.section, args.content, placeholder=args.placeholder)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == 'check':
        ok, msg = validate_json(args.file, emit_sample=False)
        if not ok:
            print(f"CHECK FAILED: {msg}")
            sys.exit(1)
        path = Path(args.file)
        raw = path.read_bytes()
        text = raw.decode('utf-8', errors='replace')
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        obj = json.loads(text)
        top_keys = sorted(obj.keys()) if isinstance(obj, dict) else []
        print(f"OK — top-level keys ({len(top_keys)}): {', '.join(top_keys)}")
        if args.keys:
            missing = [k for k in args.keys if k not in obj]
            if missing:
                print(f"MISSING KEYS: {', '.join(missing)}")
                sys.exit(1)
        sys.exit(0)

    elif args.command == 'parity':
        ok, msg = parity_locales(args.file_a, args.file_b)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == 'schema-validate':
        ok, msg = validate_locale_schema(args.file, args.schema)
        print(msg)
        sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
