import { config } from "dotenv";
config();
import { twitterClient } from "./twitterClient";
import type { TweetV2 } from "twitter-api-v2";
import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from 'ioredis';
import express, { type Request, type Response } from "express";
import { getSwapImage } from "./editImage";

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const queue = new Queue("pump-it-dump-it", { connection });
const queueEvents = new QueueEvents("pump-it-dump-it", { connection });

async function getMentions(req: Request, res: Response) {
  // const lastTweet = (await connection.get("lastTweet")) || undefined;

  const mentions = await twitterClient.v2.search('@TweetXTrade ("pump it $" OR "dump it $")', {
    max_results: 100,
    // since_id: lastTweet,
    "tweet.fields": 'author_id,text',
  });

  // if (mentions.data.meta.newest_id) await connection.set("lastTweet", mentions.data.meta.newest_id);
  if (mentions.data.meta.result_count > 0) {
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
  const transactionId = tweet.text.split(' ')[tweet.text.split(' ').length - 1];

  const res = await fetch(`${process.env.WORKER_URL!}/getTransaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'X-Custom-Auth-Key': process.env.TWITTER_BOT_AUTH_KEY_SECRET!,
    },
    // body: JSON.stringify({ twitterId: tweet.author_id, transactionId: tweet.text }),
    body: JSON.stringify({ twitterId: '12345', transactionId }),
  })

  if (res.status === 404 || res.status === 400) throw new Error(res.statusText);
  const data = await res.json();
  console.log("data fetched: ", data);

  const imageBuffer = await getSwapImage(data);
  console.log("image buffer created");

  const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { type: 'jpg' });
  console.log("media uploaded to twitter")
  await twitterClient.v2.tweet({
    reply: {
      in_reply_to_tweet_id: tweet.id,
    },
    media: { media_ids: [mediaId] }
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
