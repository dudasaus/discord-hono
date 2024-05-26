import { Context, Hono } from 'hono';
import {
  InteractionType,
  InteractionResponseType,
  APIApplicationCommandInteraction,
} from 'discord-api-types/v10';

type Handler = () => Promise<string>;

export class DiscordHono {
  private handlersRegistered = false;
  private readonly commandHandlers = new Map<string, Handler>();
  constructor(readonly app: Hono) {}

  command(name: string, handler: Handler): this {
    if (this.handlersRegistered) {
      throw new Error('Handlers already registered.');
    }
    this.commandHandlers.set(name, handler);
    return this;
  }

  async handleCommand(c: Context, body: APIApplicationCommandInteraction) {
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

  register() {
    this.handlersRegistered = true;
    this.app.post('/interactions', async (c) => {
      const body = await c.req.json();
      const { type } = body;

      if (type === InteractionType.ApplicationCommand) {
        return this.handleCommand(c, body);
      }
    });
  }
}