import urllib.request
import json

data = json.dumps({
    "from": "onboarding@resend.dev",
    "to": "parthwadhwa15@gmail.com",
    "subject": "Test from FireReach",
    "html": "<p>This is a test.</p>"
}).encode("utf-8")

req = urllib.request.Request(
    "https://api.resend.com/emails",
    data=data,
    headers={
        "Authorization": "Bearer re_Ut7JYWZN_JQ9B7JQfQZXgfNVnNHVfmCNF",
        "Content-Type": "application/json"
    }
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode("utf-8"))
