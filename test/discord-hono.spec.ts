import { Hono } from 'hono';
import { DiscordHono } from '../src/discord-hono';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  APIApplicationCommandInteraction,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';
import { RequestUtils } from './request_utils';

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

describe('discord-hono', () => {
  let app: Hono<{ Bindings: typeof MOCK_ENV }>;

  const ru = new RequestUtils();
  const DISCORD_PUBLIC_KEY = ru.publicKey;
  const MOCK_ENV = { DISCORD_PUBLIC_KEY };

  beforeEach(() => {
    app = new Hono<{ Bindings: typeof MOCK_ENV }>();
  });

  describe('setup', () => {
    test('throws an error on command after register', () => {
      expect(() => {
        const discord = new DiscordHono(app);
        discord.register();

        discord.command('should-fail', async () => 'L');
      }).toThrowError();
    });
  });

  describe('handling', () => {
    beforeEach(() => {
      const discord = new DiscordHono(app);

      discord
        .command('test-command', async () => {
          return 'Hello world';
        })
        .register();
    });

    test('responds pong to ping', async () => {
      const body = {
        type: InteractionType.Ping,
      };
      const req = ru.createRequest(body);
      const res = await app.request(req, {}, MOCK_ENV);
      const resBody = await res.json();
      expect(resBody).toStrictEqual({
        type: InteractionResponseType.Pong,
      });
      expect(res.status).toBe(200);
    });

    test('handles commands', async () => {
      const body: RecursivePartial<APIApplicationCommandInteraction> = {
        type: InteractionType.ApplicationCommand,
        data: {
          name: 'test-command',
        },
      };
      const req = ru.createRequest(body);
      const res = await app.request(req, {}, MOCK_ENV);
      const resBody = await res.json();
      expect(resBody).toStrictEqual({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: 'Hello world',
        },
      });
      expect(res.status).toBe(200);
    });

    test('returns 404 for missing handlers', async () => {
      const body: RecursivePartial<APIApplicationCommandInteraction> = {
        type: InteractionType.ApplicationCommand,
        data: {
          name: 'test-fake-command',
        },
      };
      const req = ru.createRequest(body);
      const res = await app.request(req, {}, MOCK_ENV);
      const resText = await res.text();
      expect(resText).toBe('Command handler not found');
      expect(res.status).toBe(404);
    });

    test('returns 404 for missing types', async () => {
      const body = {
        type: -1,
      };
      const req = ru.createRequest(body);
      const res = await app.request(req, {}, MOCK_ENV);
      expect(res.status).toBe(404);
    });

    test('returns 401s for bad signatures', async () => {
      const body = {
        type: InteractionType.Ping,
      };
      const req = ru.createRequest(body, true);
      const res = await app.request(req, {}, MOCK_ENV);
      expect(res.status).toBe(401);
    });
  });
});
