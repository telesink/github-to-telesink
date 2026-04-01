import "dotenv/config";
import express from "express";
import telesink from "telesink";

const app = express();

app.get("/up", (req, res) => res.status(200).send("OK"));

app.listen(3000, () => {
  console.log("running on port 3000");
  pollGitHub();
});

async function pollGitHub() {
  const EVENTS = new Set([
    "ReleaseEvent",
    "PullRequestEvent",
    "IssuesEvent",
    "PushEvent",
    "CreateEvent",
  ]);
  const etags = {};

  async function poll() {
    const res = await fetch("https://api.github.com/events", {
      headers: {
        "User-Agent": "telesink-demo",
        "If-None-Match": etags["github"] || "",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (res.status === 304) return schedule();
    if (!res.ok) return schedule();

    etags["github"] = res.headers.get("etag");
    const events = await res.json();

    for (const e of events) {
      if (!EVENTS.has(e.type)) continue;

      if (
        e.type === "PushEvent" &&
        (!e.payload.commits || e.payload.commits.length === 0)
      )
        continue;

      const success = await telesink.track({
        event: `github.${e.type.toLowerCase()}`,
        text: `${e.type} • ${e.repo.name}`,
        emoji: "🐙",
        properties: {
          repo: e.repo.name,
          actor: e.actor.login,
          url: `https://github.com/${e.repo.name}`,
        },
      });
    }

    schedule();
  }

  function schedule() {
    const delay = 60000 + Math.random() * 60000;
    setTimeout(poll, delay);
  }

  poll();
}
