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
      getEvent: () => "Release published",
      text: (e) => {
        const version = e.payload.release?.tag_name || "a new version";
        return `${version} of ${e.repo.name} by ${e.actor.login}`;
      },
    },

    PullRequestEvent: {
      emoji: "🔀",
      getEvent: (e) => {
        const action = e.payload.action;
        const pr = e.payload.pull_request;
        if (action === "closed" && pr?.merged) return "Pull request merged";
        if (action === "closed") return "Pull request closed";
        if (action === "reopened") return "Pull request reopened";
        return "Pull request opened";
      },
      text: (e) => {
        const pr = e.payload.pull_request;
        return `#${pr?.number} in ${e.repo.name} by ${e.actor.login}`;
      },
    },

    IssuesEvent: {
      emoji: "🐛",
      getEvent: (e) => {
        const action = e.payload.action;
        if (action === "closed") return "Issue closed";
        if (action === "reopened") return "Issue reopened";
        return "Issue opened";
      },
      text: (e) => {
        const issue = e.payload.issue;
        return `#${issue?.number} in ${e.repo.name} by ${e.actor.login}`;
      },
    },

    PushEvent: {
      emoji: "📤",
      getEvent: () => "Commits pushed",
      text: (e) => {
        const branch = e.payload.ref?.replace("refs/heads/", "") || "main";
        const count = e.payload.commits?.length || 0;
        return `${count} commit${count === 1 ? "" : "s"} to ${branch} in ${e.repo.name} by ${e.actor.login}`;
      },
    },

    CreateEvent: {
      emoji: "🌱",
      getEvent: (e) => {
        const type = e.payload.ref_type; // branch or tag
        return type === "tag" ? "Tag created" : "Branch created";
      },
      text: (e) => {
        const ref = e.payload.ref;
        return `“${ref}” in ${e.repo.name} by ${e.actor.login}`;
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

        const eventTitle = map.getEvent(e);

        const success = await telesink.track({
          event: eventTitle,
          text: map.text(e),
          emoji: map.emoji,
          properties: {
            repo: e.repo.name,
            actor: e.actor.login,
            url: `https://github.com/${e.repo.name}`,
          },
        });

        if (success) {
          console.log(`✅ ${map.emoji} ${eventTitle} → ${e.repo.name}`);
        }
      }
    } catch (err) {
      console.error("Poll error:", err.message);
    }

    schedule();
  }

  function schedule() {
    const delay = 60000 + Math.random() * 60000; // 60–120 seconds
    setTimeout(poll, delay);
  }

  poll();
}
