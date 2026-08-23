"""Derive a human-readable schema description from the actual payload JSON.

This lets the system prompt describe the real data shape at request time, so the
description can never drift from what the model is actually handed.
"""

_FIELD_HINTS = {
    "conversation": "the list of message nodes in the history",
    "id": "unique identifier for the node",
    "role": "the role of the message",
    "parent": "ids of the nodes this node directly follows from (incoming parents)",
    "parents": "ids of the nodes this node directly follows from (incoming parents)",
    "content": "the message text",
    "children": "ids of the nodes that directly follow from this node",
    "depth": "distance in hops to the node being continued (lower = closer, more recent)",
    "model": "the model used to produce the node",
    "title": "a short generated title for the node",
}

_ENUM_FIELDS = {"role"}


def _type_of(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "value"


def _describe_array(items, indent):
    lines = []
    if items and isinstance(items[0], dict):
        lines.append(f"{'  ' * indent}- (array of objects) each object has these fields:")
        keys = []
        for item in items:
            if isinstance(item, dict):
                for key in item:
                    if key not in keys:
                        keys.append(key)
        for key in keys:
            values = [item.get(key) for item in items if isinstance(item, dict)]
            lines.extend(_describe_field(key, values, indent + 1))
    else:
        types = sorted({_type_of(v) for v in items[:50]})
        lines.append(f"{'  ' * indent}- (array of {', '.join(types)})")
    return lines


def _describe_field(key, values, indent):
    non_null = [v for v in values if v is not None]
    hint = _FIELD_HINTS.get(key)
    pad = "  " * indent

    if not non_null:
        return [f"{pad}- `{key}`{': ' + hint if hint else ''}"]

    types = sorted({_type_of(v) for v in non_null})
    type_str = " or ".join(types)

    if "array" in types:
        items = []
        for v in non_null:
            if isinstance(v, list):
                items.extend(v)
        lines = [f"{pad}- `{key}` ({type_str}){': ' + hint if hint else ''}"]
        lines.extend(_describe_array(items, indent + 1))
        return lines

    if "object" in types:
        return [f"{pad}- `{key}` ({type_str}){': ' + hint if hint else ''}"]

    extra = ""
    if key in _ENUM_FIELDS and types == ["string"] and len(set(non_null)) <= 8:
        distinct = sorted({v for v in non_null if isinstance(v, str)})
        if distinct:
            extra = " — values: " + ", ".join(f'"{d}"' for d in distinct)

    return [f"{pad}- `{key}` ({type_str}){': ' + hint if hint else ''}{extra}"]


def derive_schema(payload):
    """Return a markdown description of the payload's structure."""
    if not isinstance(payload, dict):
        return "The history is a single JSON value."

    lines = ["The history arrives as a JSON object with these fields:", ""]
    for key, value in payload.items():
        lines.extend(_describe_field(key, [value], 0))
        lines.append("")
    return "\n".join(lines).rstrip()
