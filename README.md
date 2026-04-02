# github-to-telesink

This project relays events from the GitHub API to the [Telesink demo instance](https://demo.telesink.com), specifically to the "github" sink:

- [github sink](https://demo.telesink.com/sinks/1)
- [Telesink](https://telesink.com)

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

## License

MIT (see [LICENSE.md](/LICENSE)).
