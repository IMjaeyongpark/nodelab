
import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

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

function processRawData(rawData) {

    //열로 자르기
    let splitByLines = rawData.split("\n");
    let dates = [];
    let times = [];
    let Activity = [];
    let White_Light = [];
    let sleepWake = [];

    //열로 자르기

    for (let i = 1; i < splitByLines.length; i++) {
        let line = splitByLines[i].split(",");
        dates[i - 1] = line[0];
        times[i - 1] = line[1];
        Activity[i - 1] = line[2] && line[2] != "NaN" ? line[2] : null;
        White_Light[i - 1] = line[3] && line[3] != "NaN" ? line[3] : null;
        sleepWake[i - 1] = line[4] && (line[4].includes('0') || line[4].includes('1')) ? line[4] : null;
    }

    return { dates, times, Activity, White_Light, sleepWake }
}



const rawData = fs.readFileSync('/Users/jaeyong/Desktop/nodelab/js/sample.csv', 'utf-8');

const { dates, times, Activity, White_Light, sleepWake } = processRawData(rawData);
let timestamp = []
for (let i = 0; i < times.length; i++) {
    timestamp[i] = Date.parse(dates[i] + " " + times[i] + " GMT");
    const query = {
    text: "INSERT INTO labdata VALUES ($1, $2, $3, $4, $5)",
    values: ["test@email.com", timestamp[i]/10000.0, Activity[i], White_Light[i], sleepWake[i]],
};
client
    .query(query)
    .then((res) => {
        console.log(timestamp[i]);
    })
    .catch((e) => console.error(e.stack));
}

