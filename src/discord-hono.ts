import { Context, Hono } from 'hono';
import {
  InteractionType,
  InteractionResponseType,
  APIApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { verifySignature } from './verify';
import { Bindings } from 'hono/types';

type Handler = () => Promise<string> | string;
interface DiscordBindings extends Bindings {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APP_ID: string;
  DISCORD_API_URL?: string;
}

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export class DiscordHono<T> {
  private handlersRegistered = false;
  private readonly commandHandlers = new Map<string, Handler>();
  constructor(
    readonly app: Hono<{
      Bindings: T & DiscordBindings;
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

    const handlerResult = handler();
    if (typeof handlerResult === 'string') {
      return c.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: handlerResult,
        },
      });
    }

    // Start the late update.
    const lateUpdate = async () => {
      const content = await handler();
      const baseUrl = c.env.DISCORD_API_URL ?? 'https://discord.com/api/v10';
      const updateRequest = new Request(
        `${baseUrl}/webhooks/${c.env.DISCORD_APP_ID}/${body.token}/messages/@original`,
        {
          method: 'PATCH',
          body: JSON.stringify({ content }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const retryTimers = [1, 5, 10];
      for (let attempt of [...retryTimers, 0]) {
        const res = await fetch(updateRequest);
        if (res.ok) {
          break;
        }
        if (attempt > 0) {
          await wait(attempt * 1000);
        }
      }
    };
    c.executionCtx.waitUntil(lateUpdate());

    return c.json({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
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
