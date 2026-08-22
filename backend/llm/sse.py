import json


def format_chunk(content):
    return "data: {}\n\n".format(json.dumps({"content": content}))


def format_done():
    return "data: {}\n\n".format(json.dumps({"content": "[DONE]"}))


def format_error(message):
    return "data: {}\n\n".format(json.dumps({"error": message}))
