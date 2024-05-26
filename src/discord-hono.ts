import { Context, Hono } from 'hono';
import {
  InteractionType,
  InteractionResponseType,
  APIApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { verifySignature } from './verify';
import { Bindings } from 'hono/types';

type Handler = () => Promise<string>;
interface DiscordBindings extends Bindings {
  DISCORD_PUBLIC_KEY: string;
}

export class DiscordHono {
  private handlersRegistered = false;
  private readonly commandHandlers = new Map<string, Handler>();
  constructor(
    readonly app: Hono<{
      Bindings: DiscordBindings;
    }>,
  ) {}

  command(name: string, handler: Handler): this {
    if (this.handlersRegistered) {
      throw new Error('Handlers already registered.');
    }
    this.commandHandlers.set(name, handler);
    return this;
  }

  private async handleCommand(
    c: Context,
    body: APIApplicationCommandInteraction,
  ) {
    const commandName = body.data.name;

    const handler = this.commandHandlers.get(commandName);

    if (!handler) {
      return c.body('Command handler not found', 404);
    }

    const content = await handler();

    return c.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content,
      },
    });
  }

  private pong(c: Context) {
    return c.json({
      type: InteractionResponseType.Pong,
    });
  }

  register() {
    this.handlersRegistered = true;
    this.app.post('/interactions', async (c) => {
      const rawBody = await c.req.text();

      // Verify.
      const signature = c.req.header('x-signature-ed25519');
      const timestamp = c.req.header('x-signature-timestamp');
      const publicKey = c.env.DISCORD_PUBLIC_KEY;
      if (
        !verifySignature({
          publicKey,
          signature,
          timestamp,
          rawBody,
        })
      ) {
        return c.body('Unable to verify', 401);
      }

      const body = JSON.parse(rawBody);
      const { type } = body;

      switch (type) {
        case InteractionType.Ping:
          return this.pong(c);
        case InteractionType.ApplicationCommand:
          return this.handleCommand(c, body);
        default:
          return;
      }
    });
  }
}
