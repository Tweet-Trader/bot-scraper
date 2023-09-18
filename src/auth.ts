import LoginWithTwitter from "login-with-twitter";
import type { Request, Response } from "express";

const tw = new LoginWithTwitter({
  consumerKey: process.env.API_KEY!,
  consumerSecret: process.env.API_SECRET!,
  callbackUrl: 'https://omcgipiggbclihccejhdlfedclbcigaf.chromiumapp.org',
});

export const requestAccessToken = async (req: Request, res: Response) => {
  console.log("gets in the request access token")
  tw.login((err, secret, url) => {
    if (err) console.error(err);
    const token = url.split("=")[1];
    console.log("token: ", token);

    res.send({ token, secret });
  });
} 

export const accessToken = (req: Request, res: Response) => {
  console.log("gets in access token endpoint")
  const { token, verifier, secret } = req.body;

  tw.callback({
    oauth_token: token as string,
    oauth_verifier: verifier as string,
  }, secret as string, async (err, user) => {
    if (err) {
      // Handle the error your way
    }

    // call the cloudflare worker to store the users information if they don't exist
    // else wise, return back the bearer token for requests
    const authRes = await fetch(`${process.env.WORKER_URL}/fetchAccessToken`, {
      method: 'POST',
      headers: {
        'X-Custom-Auth-Key': process.env.TWITTER_BOT_AUTH_KEY_SECRET!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ twitterId: user.userId }),
    })
    const { token, refreshToken } = await authRes.json();

    console.log("sending tokens up")
    console.log("token: ", token)
    console.log("refreshToken: ", refreshToken)

    res.send({ twitterId: user.userId, token, refreshToken });
  });
}