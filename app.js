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
const port = 8000;

//ID값을 파라미터로 받아와 DLMO계산
app.get('/predicting_dlmo', (req, res) => {

  let { ID } = req.query;
  //ID 값 오름차순 정렬
  client.query(`SELECT * 
  FROM labdata 
  WHERE id = '${ID}' 
  ORDER BY time ASC;`, (err, result) => {
    const raws = result.rows
    try {
      const minimumTime = onmessage(raws)
      res.send(minimumTime);
    } catch (err) {
      console.log(err)
      res.status(400).json({ message: err.message });
    }
  });
});

//밀리초 단위로 시작시간과 종료 시간을 파라미터로 받아와 범위안에 데이터들로 DLMO를 계산
app.get('/', (req, res) => {

  //사용자 ID, 수집시작날짜, 수집종료날짜
  let { ID, Start_time, End_time } = req.query;

  //ID 값 시작시간부터 종료시간 사이의 값들 오름차순 정렬
  client.query(`SELECT * 
  FROM labdata 
  WHERE id = '${ID}' 
  AND time BETWEEN ${Start_time} AND ${End_time} 
  ORDER BY time ASC;`, (err, result) => {
    const raws = result.rows
    try {
      const minimumTime = onmessage(raws)
      res.send(minimumTime);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
});



app.listen(port, () => {
  console.log('실행');
});