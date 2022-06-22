import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://127.0.0.1:27017');
let db;

client.connect().then(() => {
  db = client.db('uoldb');
});

const server = express();

server.use(cors());
server.use(express.json());

server.post('/participants', (request, response) => {
  const participant = request.body;

  if (!participant) response.status(422).send('O campo nome deve ser preenchido');

  db.collection('participants')
    .insertOne(participant)
    .then(() => {
      response.send(201);
    });

  response.send('tudo ok por aqui');
});

server.get('/participants', (request, response) => {
  console.log('pegou os nomes');
  db.collection('participants')
    .find()
    .toArray()
    .then(participantsList => response.send(participantsList));
});

server.listen(5000, () => {
  console.log(chalk('Rodando na porta 5000'));
});
