import { Hono } from 'hono';
import { DiscordHono } from '../src/discord-hono';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  APIApplicationCommandInteraction,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

describe('discord-hono', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
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
      const req = new Request('https://test.com/interactions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const res = await app.request(req);
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
      const req = new Request('https://test.com/interactions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const res = await app.request(req);
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
      const req = new Request('https://test.com/interactions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const res = await app.request(req);
      const resText = await res.text();
      expect(resText).toBe('Command handler not found');
      expect(res.status).toBe(404);
    });

    test('returns 404 for missing types', async () => {
      const body = {
        type: -1,
      };
      const req = new Request('https://test.com/interactions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const res = await app.request(req);
      expect(res.status).toBe(404);
    });
  });
});
