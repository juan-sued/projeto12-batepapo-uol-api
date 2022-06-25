import dotenv from 'dotenv';
import express from 'express';
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

const participantSchema = joi.object({
  name: joi.string().required()
});

server.post('/participants', async (request, response) => {
  const participant = request.body;
  const validate = participantSchema.validate(participant, { abortEarly: false });
  const { error } = validate;

  if (error) {
    const messages = error.details.map(error => error.message);
    response.status(422).send(messages);
    console.log('caiu aqui');
    return;
  }

  try {
    connectClient();

    await db.collection('participants').insertOne(participant);
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

server.listen(5000, () => {
  console.log(chalk.cyan('Rodando na porta 5000'));
});

async function connectClient() {
  await client.connect();
}

function closeClient() {
  client.close();
}
