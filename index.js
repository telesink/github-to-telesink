import "dotenv/config";
import express from "express";
import telesink from "telesink";

const app = express();

app.get("/up", (req, res) => res.status(200).send("OK"));

app.listen(3000, () => {
  console.log("🚀 running on port 3000");
  pollGitHub();
});

async function pollGitHub() {
  const etags = {};

  const EVENT_MAP = {
    ReleaseEvent: {
      emoji: "🚀",
      name: "release",
      text: (e) => {
        const version = e.payload.release?.tag_name || "new version";
        return `Released ${version} of ${e.repo.name} by ${e.actor.login}`;
      },
    },
    PullRequestEvent: {
      emoji: "🔀",
      name: "pull_request",
      text: (e) => {
        const pr = e.payload.pull_request;
        const action =
          e.payload.action === "closed" && pr?.merged
            ? "merged"
            : e.payload.action;
        return `PR #${pr?.number} ${action} in ${e.repo.name} by ${e.actor.login}`;
      },
    },
    IssuesEvent: {
      emoji: "🐛",
      name: "issue",
      text: (e) => {
        const issue = e.payload.issue;
        return `Issue #${issue?.number} ${e.payload.action} in ${e.repo.name} by ${e.actor.login}`;
      },
    },
    PushEvent: {
      emoji: "📤",
      name: "push",
      text: (e) => {
        const branch = e.payload.ref?.replace("refs/heads/", "") || "main";
        const count = e.payload.commits?.length || 0;
        return `Pushed ${count} commit${count === 1 ? "" : "s"} to ${branch} in ${e.repo.name} by ${e.actor.login}`;
      },
    },
    CreateEvent: {
      emoji: "🌱",
      name: "create",
      text: (e) => {
        const type = e.payload.ref_type; // branch or tag
        const ref = e.payload.ref;
        return `Created ${type} ${ref} in ${e.repo.name} by ${e.actor.login}`;
      },
    },
  };

  async function poll() {
    try {
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
        const map = EVENT_MAP[e.type];
        if (!map) continue;

        if (
          e.type === "PushEvent" &&
          (!e.payload.commits || e.payload.commits.length === 0)
        )
          continue;

        const success = await telesink.track({
          event: `github.${map.name}`,
          text: map.text(e),
          emoji: map.emoji,
          properties: {
            repo: e.repo.name,
            actor: e.actor.login,
            url: `https://github.com/${e.repo.name}`,
          },
        });

        if (success) {
          console.log(`✅ ${map.emoji} ${map.name} → ${e.repo.name}`);
        }
      }
    } catch (err) {
      console.error("Poll error:", err.message);
    }

    schedule();
  }

  function schedule() {
    const delay = 60000 + Math.random() * 60000;
    setTimeout(poll, delay);
  }

  poll();
}
