import fs from 'fs';
import { getCircadianOutput } from './models.js';

let DELTA_T = 1 / 60.0;

/*
csv데이터를 가져와 열마다 잘라서 배열에 저장
1. 열마다 자르기
2. 헤더로우 인덱스 저장
3. 열 하나씩 잘라서 데이터 저장
4. 저장된 데이터 반환
*/
function processRawData(rawData) {

    //열로 자르기
    let splitByLines = rawData.split("\n");
    let dates = [];
    let times = [];
    let light = [];
    let counts = [];
    let sleepWake = [];

    let dateIndex = 2;
    let timeIndex = 3;
    let activityIndex = 5;
    let whiteLightIndex = 7;

    //해더로우 자르기
    let headerRow = splitByLines[0].split(",");
    let sleepWakeIndex = headerRow.length - 2;

    //헤더로우 인덱스 찾기
    for (let i = 0; i < headerRow.length; i++) {
        if (headerRow[i] == "Activity") {
            activityIndex = i;
        }
        if (headerRow[i] == "White Light") {
            whiteLightIndex = i;
        }

        if (headerRow[i] == "Sleep/Wake") {
            sleepWakeIndex = i;
        }

        if (headerRow[i] == "Date") {
            dateIndex = i;
        }

        if (headerRow[i] == "Time") {
            timeIndex = i;
        }
    }


    //열 하나씩 저장
    for (let i = 1; i < splitByLines.length; i++) {

        //헤더로우를 제외하고 1번부터 데이터가 들어있어서 i-1
        let row = splitByLines[i].split(",");
        dates[i - 1] = row[dateIndex];
        times[i - 1] = row[timeIndex];

        // Load time in GMT <-그리니치 평균시
        var timestamp = Date.parse(row[dateIndex] + " " + row[timeIndex] + " GMT");
        times[i - 1] = timestamp;
        light[i - 1] = parseFloat(row[whiteLightIndex]);
        counts[i - 1] = parseFloat(row[activityIndex]);
        sleepWake[i - 1] = parseFloat(row[sleepWakeIndex]);

    }
    return { dates, times, light, counts, sleepWake }
}


/*
데이터 전처리 후 반환
*/
function formatDataForIntegration(dates, times, light, counts, sleepWake) {
    let cumulativeSum = 0;
    let timeInHours = [];
    let lightIndexedByHours = [];
    let countsIndexedByHours = [];
    let combinedIndexedByHours = [];
    let sleepWakeIndexedByHours = [];
    let LIGHT_THRESHOLD = 100;
    let counter = 0;

    // Loop over all epochs and store points with valid values in arrays
    for (let i = 0; i < counts.length; i++) {
        //시간 단위로 변환
        let timestamp = (times[i]) / (1000.0 * 3600.0);

        if (isNaN(counts[i])) {
            counts[i] = 0;
        }

        if (isNaN(light[i])) {
            light[i] = 0;
        }

        if (isNaN(sleepWake[i])) {
            sleepWake[i] = 0;
        }

        //정보 저장
        if (!isNaN(timestamp)) {
            cumulativeSum = cumulativeSum + counts[i];
            countsIndexedByHours[counter] = counts[i];
            lightIndexedByHours[counter] = light[i];
            combinedIndexedByHours[counter] = light[i];

            //white light값이 100보다 작고 activity값이 0보다 크면
            if (light[i] < LIGHT_THRESHOLD && counts[i] > 0) {
                combinedIndexedByHours[counter] = counts[i];
            }
            timeInHours[counter] = timestamp;
            sleepWakeIndexedByHours[counter] = sleepWake[i];
            counter = counter + 1
        }
    }

    // Get first valid timestamp
    let firstTimestamp = timeInHours[0];
    for (let i = 0; i < timeInHours.length; i++) {
        timeInHours[i] = timeInHours[i] - firstTimestamp;
    }

    // Resample data to fill any gaps
    //분단위로 변환
    let totalMinutes = 60 * timeInHours[timeInHours.length - 1];

    let minuteByMinuteTime = [];
    let minuteByMinuteModelInput = [];
    let minuteByMinuteSleepWake = [];

    let inputIndexedByHours = combinedIndexedByHours;
    let minuteCounter = 0.0;
    let startTimeForCounts = 0;
    for (let i = 0; i < totalMinutes; i++) {

        // Store current minute (time unit is still hours)
        minuteByMinuteTime[i] = minuteCounter / 60.0;
        let countValue = 0;
        let sleepValue = 0;

        // Interpolate 
        for (let j = startTimeForCounts; j < countsIndexedByHours.length - 1; j++) {

            if (timeInHours[j] * 60 <= minuteCounter && timeInHours[j + 1] * 60 > minuteCounter) {
                let fractionComplete = (minuteCounter / 60.0 - timeInHours[j]) / (timeInHours[j + 1] - timeInHours[j]);
                countValue = inputIndexedByHours[j] + fractionComplete * (inputIndexedByHours[j + 1] - inputIndexedByHours[j]);
                sleepValue = sleepWakeIndexedByHours[j] + fractionComplete * (sleepWakeIndexedByHours[j + 1] - sleepWakeIndexedByHours[j]);
                startTimeForCounts = j;
                break;
            }
        }


        minuteByMinuteModelInput[i] = countValue;
        minuteByMinuteSleepWake[i] = Math.round(sleepValue);

        minuteCounter = minuteCounter + 1.0;

    }

    return { minuteByMinuteTime, minuteByMinuteModelInput, minuteByMinuteSleepWake, firstTimestamp }

}


function getDataForPlot(output, firstTimestamp) {


    let lengthOfDay = 24.0 / DELTA_T;
    let dlmoOffset = 7;


    let minimumTime = -24;
    let minimumValue = 99999999;
    for (let i = output.length - lengthOfDay + 1; i < output.length - 1; i = i + 1) {

        let arrayCurrentStep = output[i];
        let arrayPastStep = output[i - 1];
        let arrayNextStep = output[i + 1];

        if (arrayPastStep[0] > arrayCurrentStep[0] && arrayCurrentStep[0] < arrayNextStep[0]) {
            let tempMinimumTime = i * DELTA_T + (firstTimestamp % 24) - dlmoOffset;
            let tempMinimumValue = arrayCurrentStep[0];

            if (tempMinimumTime > minimumTime + 12) {  // If enough time has passed since the last time
                minimumValue = 99999999;
            }

            if (tempMinimumValue < minimumValue && tempMinimumValue < 0) {
                minimumValue = tempMinimumValue;
                minimumTime = i * DELTA_T;
            }
        }
    }

    var dt = new Date(firstTimestamp * 3600 * 1000); // Convert hours to milliseconds
    let utcHours = dt.getUTCHours() + dt.getUTCMinutes() / 60.0;

    minimumTime = minimumTime + ((utcHours - dlmoOffset + 24) % 24);

    return { minimumTime }
}


export function onmessage(ID, rows) {

    //const {rawData, filename} = e.data;
    console.log(rows)

    const rawData = fs.readFileSync('/Users/jaeyong/Desktop/nodelab/js/sample.csv', 'utf-8');

    const { dates, times, light, counts, sleepWake } = processRawData(rawData);

    const { minuteByMinuteTime, minuteByMinuteModelInput, minuteByMinuteSleepWake, firstTimestamp } = formatDataForIntegration(dates, times, light, counts, sleepWake);

    let output = getCircadianOutput(minuteByMinuteTime, minuteByMinuteModelInput, minuteByMinuteSleepWake, firstTimestamp);

    const { minimumTime } = getDataForPlot(output, firstTimestamp);

    return (minimumTime % 24).toFixed(2);

}
