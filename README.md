# github-to-telesink

This project relays events from the GitHub API to the [Telesink demo
instance](https://demo.telesink.com), specifically to the "github" sink:

- [github sink](https://demo.telesink.com/sinks/1)
- [Telesink](https://telesink.com)

## Overview

Polls the GitHub Events API and forwards events (e.g. pushes, stars, branch
changes) to a Telesink sink in real-time.

## Requirements

- Node.js
- Docker (for Kamal deploys)
- A GitHub personal access token
- A Telesink sink

## Configuration

Create a `.env` file:

```
GITHUB_TOKEN=your_token_here
TELESINK_ENDPOINT=https://demo.telesink.com/api/v1/sinks/<token>/events
```

## How it works

- Polls the GitHub Events API
- Uses ETags to avoid duplicate events
- Transforms events into Telesink-compatible format
- Sends them via HTTP to the configured sink

## Run locally

```sh
npm install
node index.js
```

## Deploy

1. Install `kamal` and `dotenv`:

   ```sh
   gem install kamal dotenv
   ```

2. Copy and edit `config/deploy.yml.example`:

   ```sh
   cp config/deploy.yml.example config/deploy.yml
   ```

3. Copy and edit `.env.example`:

   ```sh
   cp .env.example .env
   ```

4. Deploy:

   ```sh
   dotenv kamal deploy
   ```

## Notes

- GitHub Events API is rate-limited
- Events are not guaranteed to be real-time
- Some event types may be filtered or ignored

## License

MIT (see [LICENSE.md](/LICENSE)).
