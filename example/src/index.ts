import { Hono } from 'hono';
// Usually, this would be `from '@dudasaus/discord-hono'`
import { DiscordHono } from '../../src';

type Bindings = {
  [key in keyof Env]: Env[key];
};

const app = new Hono<{ Bindings: Bindings }>();
const discord = new DiscordHono(app);

discord
  .command('dev-fish', async () => {
    await new Promise((res) => {
      setTimeout(res, 5000);
    });
    return 'fish';
  })
  .register();

app.get('/', (c) => {
  return c.text('Hello world');
});

export default app;
