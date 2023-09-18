import express from "express";
import cors from "cors";
import { config } from "dotenv";
config();

import { getMentions }  from './transactions'
import { requestAccessToken, accessToken } from './auth'

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

app.get("/requestAccessToken", requestAccessToken);
app.get("/getMentions", getMentions);
app.post("/accessToken", accessToken);

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
