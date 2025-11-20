// rabbitmq.js
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

  console.log("[RabbitMQ] Connected & exchange ready:", EXCHANGE_NAME);
  return channel;
}

// 🔔 Publish 1 event
async function publishEvent(routingKey, payload) {
  const ch = await getChannel();

  const message = {
    routingKey,
    payload,
    timestamp: new Date().toISOString(),
  };

  ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });

  console.log(`[RabbitMQ] Published "${routingKey}"`, payload);
}

// (Để sẵn — nếu sau này bạn muốn service nào đó subscribe event)
async function subscribeEvent(queueName, bindingKeys, handler) {
  const ch = await getChannel();

  if (!Array.isArray(bindingKeys)) {
    bindingKeys = [bindingKeys];
  }

  const q = await ch.assertQueue(queueName, {
    durable: true,
  });

  for (const key of bindingKeys) {
    await ch.bindQueue(q.queue, EXCHANGE_NAME, key);
  }

  console.log(
    `[RabbitMQ] Subscribed queue "${queueName}" to keys:`,
    bindingKeys
  );

  await ch.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content.payload, content, msg);
      ch.ack(msg);
    } catch (err) {
      console.error(`[RabbitMQ] Handler error in ${queueName}:`, err.message);
      ch.nack(msg, false, false); // không requeue để tránh vòng lặp
    }
  });
}

module.exports = {
  publishEvent,
  subscribeEvent,
};
