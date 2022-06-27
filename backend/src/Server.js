import dotenv from 'dotenv';
import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';
//problema na parte de validação
// ta dando erro na hora de registrar participante

dotenv.config();
const client = new MongoClient(process.env.URL_CONNECT_MONGO);

let db;

db = client.db('uoldb');

const server = express();

server.use(cors());
server.use(express.json());

setInterval(deleteInactives, 15000);
//participants
server.post('/participants', async (request, response) => {
  const participant = request.body;

  const participantSchema = joi.object({
    name: joi.string().required()
  });
  const validate = participantSchema.validate(participant, { abortEarly: false });
  const { error } = validate;

  if (error) {
    const messages = error.details.map(error => error.message);
    response.status(422).send(messages);
    return;
  }

  try {
    connectClient();

    const isRegistered = await db.collection('participants').findOne(participant);

    if (isRegistered) {
      response.status(409).send('Usuário ja cadastrado');
      closeClient();
      return;
    }

    //refatorar
    await db.collection('participants').insertOne({
      name: participant.name,
      lastStatus: Date.now()
    });

    //refatorar
    await db.collection('messages').insertOne({
      from: participant.name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    });
    response.sendStatus(201);

    closeClient();
  } catch {
    response.status(500).send(chalk.red('Não foi possível cadastrar seu usuário.'));
    closeClient();
  }
});

server.get('/participants', async (request, response) => {
  try {
    connectClient();

    const participantsList = await db.collection('participants').find().toArray();
    response.send(participantsList);
    closeClient();
  } catch {
    response
      .status(500)
      .send(chalk.red('Não foi possível encontrar a lista de participantes.'));
    closeClient();
  }
});

//messages
server.post('/messages', async (request, response) => {
  const message = request.body;

  const messageUser = request.headers;

  try {
    connectClient();

    const isFromValid = await db
      .collection('participants')
      .findOne({ name: messageUser.user });

    const messageSchema = joi.object({
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid('message').valid('private_message'),
      from: joi.string().valid(isFromValid.name)
    });

    const validate = messageSchema.validate(message, { abortEarly: true });
    const { error } = validate;

    if (error) {
      const messagesError = error.details.map(error => error.message);
      response.status(422).send(messagesError);
      return;
    }
    try {
      connectClient();
      await db.collection('messages').insertOne({
        to: message.to,
        text: message.text,
        type: message.type,
        from: messageUser.user,
        time: dayjs().format('HH:mm:ss')
      });
      response.sendStatus(201);
      closeClient();
    } catch {
      response.send('Não foi possível enviar a mensagem.');
      closeClient();
    }
  } catch {
    response.statusCode(500);
  }
});

server.get('/messages', async (request, response) => {
  const limit = parseInt(request.query.limit);
  const messageUser = request.headers;

  try {
    connectClient();

    const userMessages = await db
      .collection('messages')
      .find({
        $or: [
          { from: messageUser.user },
          { to: messageUser.user },
          { to: 'Todos' },
          { type: 'message' }
        ]
      })
      .toArray();

    if (!limit) {
      response.send(userMessages);
      return;
    }

    const lastMessages = userMessages.slice(-limit);
    response.send(lastMessages);

    closeClient();
  } catch {
    response
      .status(500)
      .send(chalk.red('Não foi possível encontrar a lista de mensagens.'));
    closeClient();
  }
});

//status
server.post('/status', async (request, response) => {
  const message = request.body;
  const messageUser = request.headers;

  try {
    connectClient();
    const participants = await db.collection('participants');
    const participant = await db
      .collection('participants')
      .findOne({ name: messageUser.user });

    if (!participant) {
      response.sendStatus(404);
      closeClient();
      return;
    }

    await participants.updateOne(
      { name: participant.name },
      { $set: { lastStatus: Date.now() } }
    );

    response.sendStatus(200);
    closeClient();
  } catch {
    response.send('Não foi possível enviar a mensagem.');
    closeClient();
  }
});

async function deleteInactives() {
  let usersInactiveList = [];
  const timeUserInactive = Date.now() - 10000;

  try {
    connectClient();

    const partipantsInactives = await db
      .collection('participants')
      .findOne({ lastStatus: { $lt: timeUserInactive } });

    usersInactiveList.push(partipantsInactives.name);

    if (!usersInactiveList) return;

    for (let i = 0; i < usersInactiveList.length; i++) {
      await db.collection('participants').deleteOne({ name: usersInactiveList[i] });

      await db.collection('messages').insertOne({
        from: usersInactiveList[i],
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      });
    }
    usersInactiveList = [];

    closeClient();
  } catch {
    response.statusCode(500);
    closeClient();
  }
}

server.listen(5000, () => {
  console.log(chalk.cyan('Rodando na porta 5000'));
});

async function connectClient() {
  try {
    await client.connect();
  } catch {
    console.log('deu ruim no connect');
  }
}

function closeClient() {
  try {
    client.close();
  } catch {
    console.log('deu ruim no close');
  }
}
