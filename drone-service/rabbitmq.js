// drone-service/rabbitmq.js
const amqp = require("amqplib");

let connection = null;
let channel = null;

const EXCHANGE_NAME = "foodfast.events";
const EXCHANGE_TYPE = "topic";

async function getChannel() {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
  connection = await amqp.connect(url);
  channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
    durable: true,
  });

  return channel;
}

async function publishEvent(routingKey, payload) {
  const ch = await getChannel();
  const message = {
    routingKey,
    payload,
    timestamp: Date.now(),
  };

  ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });

  console.log("[RabbitMQ] Published", routingKey, payload);
}

async function subscribeEvent(queueName, bindingKeys, handler) {
  const ch = await getChannel();

  await ch.assertQueue(queueName, { durable: true });

  for (const key of bindingKeys) {
    await ch.bindQueue(queueName, EXCHANGE_NAME, key);
  }

  console.log(
    `[RabbitMQ] Subscribed queue "${queueName}" to:`,
    bindingKeys.join(", ")
  );

  ch.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content.payload, content);
      ch.ack(msg);
    } catch (err) {
      console.error("[RabbitMQ] Handler error:", err.message);
      ch.nack(msg, false, false); // không requeue
    }
  });
}

module.exports = {
  publishEvent,
  subscribeEvent,
};
