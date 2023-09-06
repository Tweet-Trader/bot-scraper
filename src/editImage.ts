import { createCanvas, loadImage, registerFont } from "canvas";
import fs  from "fs";
import path from "path";
import { fromBytes, formatUnits } from 'viem';

// Register the font
registerFont(path.resolve(__dirname, 'Inter/static/Inter-ExtraBold.ttf'), { family: "Inter" });

const getAmount = (amount: Uint8Array, decimals: number) => {
  const amountRaw = fromBytes(amount, "bigint");
  const amountFormatted = formatUnits(amountRaw, decimals).split('.')[0];

  return amountFormatted;
}

type Transaction = {
  id: string;
  hash: string;
  wallet_address: string;
  twitter_id: string;
  token_address: string;
  token_price: number;
  decimals: number;
  symbol: string;
  amount_in: Uint8Array;
  amount_out: Uint8Array;
  swap_type: 'BUY' | 'SELL';
  block_number: number;
}
export const getSwapImage = async (tx: Transaction) => {
  // prepare data
  const date = new Date();
  const imagePath = path.resolve(__dirname,
    tx.swap_type === 'BUY' ? "assets/shib-buy.png" : "assets/pepe-sell.png");
  const ethAmount = getAmount(tx.swap_type === 'BUY' ? tx.amount_in : tx.amount_out, 18);
  const tokenAmount = getAmount(tx.swap_type === 'BUY' ? tx.amount_out : tx.amount_in, tx.decimals);
  const currency = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 3,
    currencyDisplay: 'narrowSymbol',
  })

  // Create canvas
  const canvas = createCanvas(815, 508);
  const ctx = canvas.getContext("2d");

  // Load image
  const image = await loadImage(imagePath);
  ctx.drawImage(image, 0, 0, 815, 508);

  // Set font settings
  ctx.font = '50px "Inter"';
  ctx.fillStyle = "#f1f5f9";

  // Add text
  ctx.fillText(`${ethAmount} ETH ${tx.swap_type}`, 50, 215);
  ctx.fillStyle = "#4ade80";
  ctx.fillText(`${tokenAmount} $${tx.symbol}`, 50, 280);

  ctx.font = '15px "Inter"';
  ctx.fillStyle = "#f1f5f9";
  ctx.fillText(`$${tx.symbol} PRICE:   ${currency.format(tx.token_price)}`, 53, 315);
  ctx.fillText(
    `${date.getDate()}/${date.getMonth()}/${date.getFullYear()}`,
    53,
    335,
  );

  // Save image
  const buffer = canvas.toBuffer("image/jpeg");

  return buffer;
}
