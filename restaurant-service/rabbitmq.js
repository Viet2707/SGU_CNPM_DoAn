const amqp = require("amqplib");
let channel = null;

const EXCHANGE = "foodfast.events";
const URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

async function getChannel() {
  if (channel) return channel;

  const conn = await amqp.connect(URL);
  channel = await conn.createChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  console.log("[RabbitMQ] Restaurant-Service connected to exchange:", EXCHANGE);
  return channel;
}

async function publishEvent(routingKey, payload) {
  const ch = await getChannel();
  ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify({
    routingKey,
    payload,
    timestamp: new Date().toISOString()
  })), { persistent: true });

  console.log(`[RabbitMQ] Published "${routingKey}"`, payload);
}

module.exports = { publishEvent };
