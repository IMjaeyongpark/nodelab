import express from 'express';
import { onmessage } from './js/prep_data.js';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Client } = pkg;

const client = new Client({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
});
client.connect();

// express 가져오기
const app = express();
const port = 8000; // port number - ncp에서 열었던 포트 번호 

app.get('/predicting_dlmo', (req, res) => {

  let rows
  client.query("SELECT * FROM public.labdata WHERE id = 'test@email.com';", (err, result) => {
    rows = result.rows
    let { ID } = req.query;
    const minimumTime = onmessage(ID, rows)
    console.log('minimumTime: ' + minimumTime)

    res.send('하이');
  });
});


app.post('/', (req, res) => {
  //사용자 ID, 수집시작날짜, 수집종료날짜
  let { ID, Start_time, End_time } = req.query;
  res.send('하이');
});


app.listen(port, () => {
  console.log('실행');
});