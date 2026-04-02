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
  const seen = new Set();

  const EVENT_MAP = {
    ReleaseEvent: {
      emoji: "🚀",
      getEvent: () => "Release published",
      text: (e) =>
        `${e.payload.release?.tag_name || "a new version"} of ${e.repo.name} by ${e.actor.login}`,
    },

    PullRequestEvent: {
      emoji: "🔀",
      getEvent: (e) => {
        const a = e.payload.action;
        const pr = e.payload.pull_request;
        if (a === "closed" && pr?.merged) return "Pull request merged";
        if (a === "closed") return "Pull request closed";
        if (a === "reopened") return "Pull request reopened";
        return "Pull request opened";
      },
      text: (e) =>
        `#${e.payload.pull_request?.number} in ${e.repo.name} by ${e.actor.login}`,
    },

    IssuesEvent: {
      emoji: "🐛",
      getEvent: (e) => {
        const a = e.payload.action;
        if (a === "closed") return "Issue closed";
        if (a === "reopened") return "Issue reopened";
        return "Issue opened";
      },
      text: (e) =>
        `#${e.payload.issue?.number} in ${e.repo.name} by ${e.actor.login}`,
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
      emoji: "🏷️",
      getEvent: (e) => (e.payload.ref_type === "tag" ? "Tag created" : null),
      text: (e) => `“${e.payload.ref}” in ${e.repo.name} by ${e.actor.login}`,
    },

    DeleteEvent: {
      emoji: "🗑️",
      getEvent: (e) => (e.payload.ref_type === "tag" ? "Tag deleted" : null),
      text: (e) => `“${e.payload.ref}” in ${e.repo.name} by ${e.actor.login}`,
    },

    ForkEvent: {
      emoji: "🍴",
      getEvent: () => "Repository forked",
      text: (e) => `${e.repo.name} was forked by ${e.actor.login}`,
    },

    WatchEvent: {
      emoji: "⭐",
      getEvent: () => "Repository starred",
      text: (e) => `${e.repo.name} starred by ${e.actor.login}`,
    },

    PullRequestReviewEvent: {
      emoji: "👀",
      getEvent: () => "Pull request reviewed",
      text: (e) =>
        `#${e.payload.pull_request?.number} reviewed in ${e.repo.name} by ${e.actor.login}`,
    },

    IssueCommentEvent: {
      emoji: "💬",
      getEvent: () => "Issue comment",
      text: (e) =>
        `Comment on #${e.payload.issue?.number} in ${e.repo.name} by ${e.actor.login}`,
    },

    PullRequestReviewCommentEvent: {
      emoji: "💭",
      getEvent: () => "Review comment",
      text: (e) =>
        `Comment on PR #${e.payload.pull_request?.number} in ${e.repo.name} by ${e.actor.login}`,
    },

    DiscussionEvent: {
      emoji: "💬",
      getEvent: () => "Discussion started",
      text: (e) =>
        `${e.payload.discussion?.title || "new discussion"} in ${e.repo.name}`,
    },

    MemberEvent: {
      emoji: "👤",
      getEvent: () => "Collaborator added",
      text: (e) => `${e.payload.member?.login} added to ${e.repo.name}`,
    },

    PublicEvent: {
      emoji: "🌍",
      getEvent: () => "Repository made public",
      text: (e) => `${e.repo.name} is now public`,
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
        if (seen.has(e.id)) continue;
        seen.add(e.id);

        const map = EVENT_MAP[e.type];
        if (!map) continue;

        const eventTitle = map.getEvent(e);
        if (eventTitle === null) continue;

        if (
          e.type === "PushEvent" &&
          (!e.payload.commits || e.payload.commits.length === 0)
        )
          continue;

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

      if (seen.size > 2000) {
        const trimmed = Array.from(seen).slice(-1000);
        seen.clear();
        trimmed.forEach((id) => seen.add(id));
      }
    } catch (err) {
      console.error("GitHub poll error:", err.message);
    }

    schedule();
  }

  function schedule() {
    const delay = 60000 + Math.random() * 60000; // 60–120 seconds
    setTimeout(poll, delay);
  }

  poll();
}
