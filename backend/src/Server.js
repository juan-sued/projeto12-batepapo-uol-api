import dotenv from 'dotenv';
import express, { response } from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import joi from 'joi';

//problema na parte de validação
// ta dando erro na hora de registrar participante

dotenv.config();
const client = new MongoClient(process.env.URL_CONNECT_MONGO);

let db;

db = client.db('uoldb');

const server = express();

server.use(cors());
server.use(express.json());

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

    userValidation(participant, response);

    //refatorar
    await db.collection('participants').insertOne({
      name: participant.name,
      lastStatus: Date.now()
    });
    response.sendStatus(201);

    //refatorar
    await db.collection('messages').insertOne({
      from: participant.name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: `${Date.getHours()}:${Date.getMinutes()}:${Date.getSeconds()}`
    });

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

server.post('/messages', async (request, response) => {
  const message = request.body;
  const messageUser = request.headers.User;

  const isFromValid = db.collection('participants').findOne(messageUser);

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
      from: messageUser,
      time: `${Date.getHours()}:${Date.getMinutes()}:${Date.getSeconds()}`
    });
    response.sendStatus(201);
    closeClient();
  } catch {
    response.status().send('Não foi possível enviar a mensagem.');
    closeClient();
  }
});

server.get('/messages', async (request, response) => {
  const limit = parseInt(request.query.limit);

  try {
    connectClient();
    const messagesList = await db.collection('messages').find().toArray();

    if (!limit) response.send(messagesList);

    const lastMessages = messagesList.reverse().filter((message, index) => index < limit);
    console.log(lastMessages);
    response.send(lastMessages);

    closeClient();
  } catch {
    response
      .status(500)
      .send(chalk.red('Não foi possível encontrar a lista de mensagens.'));
    closeClient();
  }
});

server.listen(5500, () => {
  console.log(chalk.cyan('Rodando na porta 5500'));
});

async function connectClient() {
  await client.connect();
}

function closeClient() {
  client.close();
}

async function userValidation(participant, response) {
  const isRegistered = await db.collection('participants').findOne(participant);
  if (isRegistered) {
    response.status(409).send('Usuário ja cadastrado');
    closeClient();
    return;
  }
}
