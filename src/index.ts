import { config } from "dotenv";
config();
import { twitterClient } from "./twitterClient";
import type { TweetV2 } from "twitter-api-v2";
import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from 'ioredis';
import express, { type Request, type Response } from "express";

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

const connection = new IORedis({
  port: 6379,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

const queue = new Queue("pump-it-dump-it", { connection });
const queueEvents = new QueueEvents("pump-it-dump-it", { connection });

async function getMentions(req: Request, res: Response) {
  const lastTweet = (await connection.get("lastTweet")) || undefined;
  console.log("last tweet: ", lastTweet);

  // const mentions = await twitterClient.v2.search('@puterbooter ("pump it $" OR "dump it $")', { max_results: 100 })
  const mentions = await twitterClient.v2.search('@satsdart', { max_results: 10, since_id: lastTweet })
  console.log("mentions: ", mentions.data)

  if (mentions.data.meta.newest_id) await connection.set("lastTweet", mentions.data.meta.newest_id);
  if (mentions.data.meta.result_count > 0) {
    console.log("mentions data data: ", mentions.data.data);
    const tweetJobs = mentions.data.data.map((tweet) => ({
      name: "pump-it-dump-it",
      data: tweet,
      opts: { 
        id: tweet.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        }
      },
    }))
    await queue.addBulk(tweetJobs)
  }

  return res.json({ status: 200, body: 'twitter mentions scraped' });
}

const worker = new Worker("pump-it-dump-it", async ({ data: tweet }: { data: TweetV2 }) => {
  await twitterClient.v2.tweet(`test tweet`, {
    reply: {
      in_reply_to_tweet_id: tweet.id,
    }
  });
  console.log(`Replied to tweet ID: ${tweet.id}`);
}, { 
  connection,
  concurrency: 5,
})

worker.on("error", (err) => {
  console.error(err);
});

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`A job with ID ${jobId} is waiting`);
});

queueEvents.on('active', ({ jobId, prev }) => {
  console.log(`Job ${jobId} is now active; previous status was ${prev}`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`${jobId} has completed and returned ${returnvalue}`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.log(`${jobId} has failed with reason ${failedReason}`);
});

app.get("/getMentions", getMentions);

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
