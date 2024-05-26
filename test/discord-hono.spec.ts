import { Hono } from 'hono';
import { DiscordHono } from '../src/discord-hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  APIApplicationCommandInteraction,
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';
import { RequestUtils } from './request_utils';
import { TestExecutionContext } from './test_execution_context';

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

describe('discord-hono', () => {
  let app: Hono<{ Bindings: typeof MOCK_ENV }>;
  let executionCtx: TestExecutionContext;

  const ru = new RequestUtils();
  const DISCORD_PUBLIC_KEY = ru.publicKey;
  const DISCORD_APP_ID = 'abcdef';
  const DISCORD_API_URL = 'https://discord/api/v100';
  const MOCK_ENV = {
    DISCORD_PUBLIC_KEY,
    DISCORD_APP_ID,
    DISCORD_API_URL,
    somethingElseTypeTest: 12345,
  };

  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response());

  beforeEach(() => {
    app = new Hono<{ Bindings: typeof MOCK_ENV }>();
    executionCtx = new TestExecutionContext();
    vi.clearAllMocks();
  });

  describe('setup', () => {
    test('throws an error on command after register', () => {
      expect(() => {
        const discord = new DiscordHono(app);
        discord.register();

        discord.command('should-fail', () => 'L');
      }).toThrowError();
    });
  });

  describe('handling', () => {
    beforeEach(() => {
      const discord = new DiscordHono(app);

      discord
        .command('test-delayed-command', async () => {
          return 'delayed';
        })
        .command('test-instant-command', () => 'instant')
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

    test('handles insant commands', async () => {
      const body: RecursivePartial<APIApplicationCommandInteraction> = {
        type: InteractionType.ApplicationCommand,
        data: {
          name: 'test-instant-command',
        },
      };
      const req = ru.createRequest(body);
      const res = await app.request(req, {}, MOCK_ENV);
      const resBody = await res.json();
      expect(resBody).toStrictEqual({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: 'instant',
        },
      });
      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('handles delayed commands', async () => {
      const body: RecursivePartial<APIApplicationCommandInteraction> = {
        type: InteractionType.ApplicationCommand,
        data: {
          name: 'test-delayed-command',
        },
        token: 'i-am-token',
      };
      const req = ru.createRequest(body);
      const res = await app.request(req, {}, MOCK_ENV, executionCtx);
      expect(res.status).toBe(200);
      const resBody = await res.json();
      expect(resBody).toStrictEqual({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
      });
      await executionCtx.waitForComplete();

      const expectedToken = 'i-am-token';
      const expectedRequestUrl = `${DISCORD_API_URL}/webhooks/${DISCORD_APP_ID}/${expectedToken}/messages/@original`;
      const expectedUpdateRequest = new Request(expectedRequestUrl, {
        method: 'PATCH',
        body: JSON.stringify({ content: 'delayed' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [actualRequest] = fetchSpy.mock.lastCall! as [Request];
      expect(actualRequest.url).toBe(expectedUpdateRequest.url);
      expect(actualRequest.method).toBe(expectedUpdateRequest.method);
      expect(await actualRequest.json()).toStrictEqual(
        await expectedUpdateRequest.json(),
      );
      expect(actualRequest.headers).toStrictEqual(
        expectedUpdateRequest.headers,
      );
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
